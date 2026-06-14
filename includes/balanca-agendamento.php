<?php

declare(strict_types=1);

require_once __DIR__ . "/conexao.php";
require_once __DIR__ . "/admin-ecoponto-data.php";
require_once __DIR__ . "/notificacoes_helper.php";

function balanca_calcular_pontos(float $pesoKg): int
{
    if ($pesoKg <= 0) {
        return 0;
    }
    return max(1, (int) round($pesoKg * 10));
}

function balanca_peso_sugerido_por_residuo(): array
{
    return [
        "plastico" => 0.85,
        "papel" => 1.2,
        "vidro" => 1.5,
        "metal" => 0.65,
        "organico" => 2.1,
        "eletronico" => 2.8,
        "misto" => 1.0,
        "madeira" => 1.75,
    ];
}

function balanca_peso_recomendado_total(array $tipos): float
{
    $mapa = balanca_peso_sugerido_por_residuo();
    $total = 0.0;
    foreach ($tipos as $tipo) {
        $t = strtolower(trim((string) $tipo));
        if (isset($mapa[$t])) {
            $total += (float) $mapa[$t];
        }
    }
    return round($total, 2);
}

function balanca_garantir_schema_agendamento(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
        return;
    }

    if (!ecoadm_agendamento_tem_coluna($conn, "peso_pendente_kg")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN peso_pendente_kg DECIMAL(10,2) NULL DEFAULT NULL AFTER tipo_residuo"
        );
    }
    if (!ecoadm_agendamento_tem_coluna($conn, "pontos_pendentes")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN pontos_pendentes INT NULL DEFAULT NULL AFTER peso_pendente_kg"
        );
    }
    if (!ecoadm_agendamento_tem_coluna($conn, "peso_status")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN peso_status ENUM('estimado','pendente','confirmado') NULL DEFAULT NULL AFTER pontos_pendentes"
        );
    }
}

function balanca_agendamento_tem_coluna_peso(mysqli $conn): bool
{
    balanca_garantir_schema_agendamento($conn);
    return ecoadm_agendamento_tem_coluna($conn, "peso_pendente_kg")
        && ecoadm_agendamento_tem_coluna($conn, "pontos_pendentes");
}

function balanca_confirmar_pontos_agendamento(
    mysqli $conn,
    int $idAgendamento,
    int $idPevFallback = 0
): bool {
    balanca_garantir_schema_agendamento($conn);

    if ($idAgendamento <= 0 || !balanca_agendamento_tem_coluna_peso($conn)) {
        return false;
    }

    if (ecoadm_entrega_tem_coluna($conn, "id_agendamento")) {
        $stmtDup = $conn->prepare(
            "SELECT id_entrega FROM entrega WHERE id_agendamento = ? LIMIT 1"
        );
        if ($stmtDup) {
            $stmtDup->bind_param("i", $idAgendamento);
            if ($stmtDup->execute() && ecocoleta_stmt_fetch_one_assoc($stmtDup)) {
                $stmtDup->close();
                return true;
            }
            $stmtDup->close();
        }
    }

    $stmtAg = $conn->prepare(
        "SELECT a.id_usuario, a.data_coleta, a.status_coleta,
                COALESCE(a.id_pev, 0) AS id_pev,
                COALESCE(a.peso_pendente_kg, 0) AS peso_pendente_kg,
                COALESCE(a.pontos_pendentes, 0) AS pontos_pendentes,
                COALESCE(a.peso_status, '') AS peso_status,
                COALESCE(NULLIF(TRIM(a.responsavel), ''), '') AS responsavel
         FROM agendamento_coleta_morador a
         WHERE a.id_agendamento = ? LIMIT 1"
    );
    if (!$stmtAg) {
        return false;
    }
    $stmtAg->bind_param("i", $idAgendamento);
    if (!$stmtAg->execute()) {
        $stmtAg->close();
        return false;
    }
    $ag = ecocoleta_stmt_fetch_one_assoc($stmtAg);
    $stmtAg->close();

    if (!$ag || (string) ($ag["status_coleta"] ?? "") !== "concluida") {
        return false;
    }

    $peso = (float) ($ag["peso_pendente_kg"] ?? 0);
    if ($peso <= 0) {
        return false;
    }

    $idUsuario = (int) ($ag["id_usuario"] ?? 0);
    $idPev = (int) ($ag["id_pev"] ?? 0);
    if ($idPev <= 0) {
        $idPev = $idPevFallback;
    }
    if ($idUsuario <= 0 || $idPev <= 0) {
        return false;
    }

    $pontos = (int) ($ag["pontos_pendentes"] ?? 0);
    if ($pontos <= 0) {
        $pontos = balanca_calcular_pontos($peso);
    }

    $dataColeta = (string) ($ag["data_coleta"] ?? date("Y-m-d"));
    $dataEntrega = $dataColeta . " 14:30:00";
    $nomePev = ecoadm_nome_pev_por_id($conn, $idPev);
    $responsavelEntrega = ecoadm_resolver_responsavel_admin(
        $conn,
        $idPev,
        (string) ($ag["responsavel"] ?? ""),
        $idAgendamento
    );

    $conn->begin_transaction();
    try {
        $cols = "data_entrega, peso_total, pontos_gerados, id_usuario, id_pev";
        $vals = "?, ?, ?, ?, ?";
        $types = "sdiii";
        $params = [$dataEntrega, $peso, $pontos, $idUsuario, $idPev];

        if (ecoadm_entrega_tem_coluna($conn, "status_material")) {
            $cols .= ", status_material";
            $vals .= ", 'coletado'";
        }
        if (ecoadm_entrega_tem_coluna($conn, "id_agendamento")) {
            $cols .= ", id_agendamento";
            $vals .= ", ?";
            $types .= "i";
            $params[] = $idAgendamento;
        }
        if (ecoadm_entrega_tem_coluna($conn, "responsavel")) {
            $cols .= ", responsavel";
            $vals .= ", ?";
            $types .= "s";
            $params[] = $responsavelEntrega;
        }

        $stmtE = $conn->prepare("INSERT INTO entrega ({$cols}) VALUES ({$vals})");
        if (!$stmtE) {
            throw new RuntimeException("prepare entrega balanca");
        }
        $stmtE->bind_param($types, ...$params);
        if (!$stmtE->execute()) {
            $stmtE->close();
            throw new RuntimeException("insert entrega balanca");
        }
        $idEntrega = (int) $conn->insert_id;
        $stmtE->close();

        if (ecoadm_agendamento_tem_coluna($conn, "peso_status")) {
            $stmtUp = $conn->prepare(
                "UPDATE agendamento_coleta_morador SET peso_status = 'confirmado' WHERE id_agendamento = ? LIMIT 1"
            );
            if ($stmtUp) {
                $stmtUp->bind_param("i", $idAgendamento);
                $stmtUp->execute();
                $stmtUp->close();
            }
        }

        if (ecocoleta_usuario_tem_coluna_saldo_ecopoints($conn)) {
            $novoSync = ecocoleta_obter_saldo_calculado_entrega_resgate($conn, $idUsuario);
            $stmtSaldo = $conn->prepare("UPDATE usuario SET saldo_ecopoints = ? WHERE id_usuario = ?");
            if ($stmtSaldo) {
                $stmtSaldo->bind_param("ii", $novoSync, $idUsuario);
                $stmtSaldo->execute();
                $stmtSaldo->close();
            }
        }

        $conn->commit();

        if ($idEntrega > 0) {
            ecocoleta_notif_entrega($conn, $idUsuario, $idEntrega, $pontos, $nomePev);
        }
        ecoadm_invalidar_cache_admin();
        return true;
    } catch (Throwable $e) {
        $conn->rollback();
        return false;
    }
}
