<?php

declare(strict_types=1);

require_once __DIR__ . "/dashboard-plataforma-seed.php";
require_once __DIR__ . "/ecopontos-repository.php";

const ECOPLAT_REL_SEED_PONTOS_MIN = 210;
const ECOPLAT_REL_SEED_PONTOS_MAX = 289;
const ECOPLAT_REL_MIN_MESES_ANO = 6;
const ECOPLAT_REL_ENTREGAS_POR_MES = 8;

function ecoplat_relatorio_sql_marca_seed(): string
{
    return "pontos_gerados BETWEEN " . ECOPLAT_REL_SEED_PONTOS_MIN
        . " AND " . ECOPLAT_REL_SEED_PONTOS_MAX;
}

function ecoplat_relatorio_contar_entregas_periodo(mysqli $conn, string $desde, string $ate): int
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return 0;
    }

    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS c FROM entrega
         WHERE DATE(data_entrega) >= ? AND DATE(data_entrega) <= ?"
    );
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("ss", $desde, $ate);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    return (int) ($row["c"] ?? 0);
}

function ecoplat_relatorio_contar_meses_seed_ano(mysqli $conn, int $ano): int
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return 0;
    }

    $desde = $ano . "-01-01";
    $ate = $ano . "-12-31";
    $sql = "SELECT COUNT(DISTINCT DATE_FORMAT(data_entrega, '%Y-%m')) AS c
            FROM entrega
            WHERE " . ecoplat_relatorio_sql_marca_seed() . "
              AND DATE(data_entrega) >= ? AND DATE(data_entrega) <= ?";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("ss", $desde, $ate);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    return (int) ($row["c"] ?? 0);
}

function ecoplat_relatorio_mes_tem_seed(mysqli $conn, int $ano, int $mes): bool
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return false;
    }

    $inicio = sprintf("%04d-%02d-01", $ano, $mes);
    $fim = date("Y-m-t", strtotime($inicio));
    $sql = "SELECT COUNT(*) AS c FROM entrega
            WHERE " . ecoplat_relatorio_sql_marca_seed() . "
              AND DATE(data_entrega) >= ? AND DATE(data_entrega) <= ?";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param("ss", $inicio, $fim);
    if (!$stmt->execute()) {
        $stmt->close();
        return false;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    return (int) ($row["c"] ?? 0) > 0;
}

function ecoplat_relatorio_limpar_seed(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return;
    }

    if (ecocoleta_tabela_existe($conn, "item_entrega")) {
        @$conn->query(
            "DELETE ie FROM item_entrega ie
             INNER JOIN entrega e ON e.id_entrega = ie.id_entrega
             WHERE e." . ecoplat_relatorio_sql_marca_seed()
        );
    }

    @$conn->query("DELETE FROM entrega WHERE " . ecoplat_relatorio_sql_marca_seed());
}

function ecoplat_relatorio_sincronizar_seed(mysqli $conn, bool $forcar = false): array
{
    $stats = ["inseridos" => 0, "itens" => 0, "ano" => (int) date("Y")];

    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return $stats;
    }

    ecoadm_garantir_schema_integracao($conn);
    ecopontos_garantir_schema($conn);
    ecoplat_dashboard_garantir_materiais($conn, $stats);

    $ano = (int) date("Y");
    $mesesComSeed = ecoplat_relatorio_contar_meses_seed_ano($conn, $ano);

    if (!$forcar && $mesesComSeed >= ECOPLAT_REL_MIN_MESES_ANO) {
        return $stats;
    }

    if ($forcar) {
        ecoplat_relatorio_limpar_seed($conn);
    }

    $usuarios = ecoplat_dashboard_listar_ids_usuario($conn);
    $materiais = ecoplat_dashboard_mapa_materiais($conn);
    $idsPev = ecoplat_dashboard_listar_ids_pev($conn);

    if ($usuarios === [] || $materiais === [] || $idsPev === []) {
        ecopontos_sincronizar_catalogo($conn, false);
        $idsPev = ecoplat_dashboard_listar_ids_pev($conn);
    }

    if ($usuarios === [] || $materiais === [] || $idsPev === []) {
        return $stats;
    }

    $pesosMaterial = [
        "plastico" => 1.4,
        "papel" => 1.05,
        "vidro" => 0.9,
        "metal" => 0.75,
        "organico" => 1.15,
        "madeira" => 0.95,
        "outros" => 0.8,
    ];

    $mesAtual = (int) date("n");
    $temItens = ecocoleta_tabela_existe($conn, "item_entrega");
    $slugs = array_keys($materiais);
    $cursor = 0;

    for ($mes = 1; $mes <= $mesAtual; $mes++) {
        if (!$forcar && ecoplat_relatorio_mes_tem_seed($conn, $ano, $mes)) {
            continue;
        }

        $diasNoMes = (int) date("t", strtotime(sprintf("%04d-%02d-01", $ano, $mes)));
        $entregasMes = ECOPLAT_REL_ENTREGAS_POR_MES + ($mes % 3);
        $fatorMes = 0.72 + ($mes / max(1, $mesAtual)) * 0.55;

        for ($e = 0; $e < $entregasMes; $e++) {
            $uid = $usuarios[$cursor % count($usuarios)];
            $idPev = $idsPev[$cursor % count($idsPev)];
            $dia = min($diasNoMes, 2 + (($e * 5 + $mes) % max(1, $diasNoMes - 1)));
            $hora = 8 + (($cursor + $e) % 10);
            $dataEntrega = sprintf("%04d-%02d-%02d %02d:30:00", $ano, $mes, $dia, $hora);
            $pontos = ECOPLAT_REL_SEED_PONTOS_MIN + ($cursor % (ECOPLAT_REL_SEED_PONTOS_MAX - ECOPLAT_REL_SEED_PONTOS_MIN + 1));
            $cursor++;

            $stmtE = $conn->prepare(
                "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario, id_pev)
                 VALUES (?, 0, ?, ?, ?)"
            );
            if (!$stmtE) {
                continue;
            }
            $stmtE->bind_param("siii", $dataEntrega, $pontos, $uid, $idPev);
            if (!$stmtE->execute()) {
                $stmtE->close();
                continue;
            }
            $idEntrega = (int) $conn->insert_id;
            $stmtE->close();
            $stats["inseridos"]++;

            if (!$temItens) {
                $peso = round(12 + (($mes + $e) % 22) + ($cursor % 10) / 10, 2);
                $upd = $conn->prepare("UPDATE entrega SET peso_total = ? WHERE id_entrega = ?");
                if ($upd) {
                    $upd->bind_param("di", $peso, $idEntrega);
                    $upd->execute();
                    $upd->close();
                }
                continue;
            }

            $pesoTotal = 0.0;
            $qtdItens = min(4, count($slugs));

            for ($k = 0; $k < $qtdItens; $k++) {
                $slug = $slugs[($cursor + $k) % count($slugs)];
                $idMat = $materiais[$slug] ?? 0;
                if ($idMat <= 0) {
                    continue;
                }
                $fator = $pesosMaterial[$slug] ?? 1.0;
                $peso = round(
                    (5 + (($mes + $k + $e) % 16) + ($cursor % 8) / 10) * $fator * $fatorMes,
                    2
                );
                $pesoTotal += $peso;

                $stmtI = $conn->prepare(
                    "INSERT INTO item_entrega (quantidade, peso, id_entrega, id_material) VALUES (1, ?, ?, ?)"
                );
                if ($stmtI) {
                    $stmtI->bind_param("dii", $peso, $idEntrega, $idMat);
                    if ($stmtI->execute()) {
                        $stats["itens"]++;
                    }
                    $stmtI->close();
                }
            }

            if ($pesoTotal > 0) {
                $upd = $conn->prepare("UPDATE entrega SET peso_total = ? WHERE id_entrega = ?");
                if ($upd) {
                    $upd->bind_param("di", $pesoTotal, $idEntrega);
                    $upd->execute();
                    $upd->close();
                }
            }
        }
    }

    return $stats;
}

function ecoplat_relatorio_garantir_dados(mysqli $conn, bool $forcar = false): array
{
    require_once __DIR__ . "/agendamentos-plataforma-seed.php";

    ecoadm_garantir_schema_integracao($conn);
    ecopontos_garantir_schema($conn);
    ecopontos_garantir_todos_ativos($conn);
    ecoagend_vincular_pev_existentes($conn);

    $entregasRel = ecoplat_relatorio_sincronizar_seed($conn, $forcar);
    $entregasDash = ecoplat_dashboard_sincronizar_seed($conn, false);

    return [
        "relatorio" => $entregasRel,
        "dashboard" => $entregasDash,
    ];
}
