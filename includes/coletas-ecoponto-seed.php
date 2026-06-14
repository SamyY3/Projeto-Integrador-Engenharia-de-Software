<?php

declare(strict_types=1);

require_once __DIR__ . "/admin-ecoponto-data.php";
require_once __DIR__ . "/usuarios-seed-data.php";

const ECOCOLETAS_SEED_EMAIL_SUFFIX = ECOSEED_USUARIOS_EMAIL_SUFFIX;
const ECOCOLETAS_SEED_TOTAL = ECOSEED_USUARIOS_TOTAL;

const ECOCOLETAS_SEED_HOJE_QTD = 12;

function ecocoletas_seed_parametros(int $idx, DateTimeImmutable $hoje): array
{
    $statuses = ["confirmado", "andamento", "concluida", "confirmado"];

    if ($idx < ECOCOLETAS_SEED_HOJE_QTD) {
        return [
            "data" => $hoje->format("Y-m-d"),
            "slot" => $idx % 5,
            "tipo" => "caminhao",
            "status" => $statuses[$idx % count($statuses)],
        ];
    }

    $diasOffset = -(($idx - ECOCOLETAS_SEED_HOJE_QTD) % 21 + 1);

    return [
        "data" => $hoje->modify("{$diasOffset} days")->format("Y-m-d"),
        "slot" => ($idx + 2) % 5,
        "tipo" => ($idx % 4 === 0) ? "prefeitura" : "caminhao",
        "status" => $statuses[$idx % count($statuses)],
    ];
}

function ecocoletas_seed_buscar_agendamento(mysqli $conn, int $idUsuario): int
{
    $stmt = $conn->prepare(
        "SELECT id_agendamento FROM agendamento_coleta_morador
         WHERE id_usuario = ? ORDER BY id_agendamento DESC LIMIT 1"
    );
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("i", $idUsuario);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $id = 0;
    $stmt->bind_result($id);
    $stmt->fetch();
    $stmt->close();
    return (int) $id;
}

function ecocoletas_seed_resolver_pev(mysqli $conn): int
{
    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return 0;
    }

    $idCatalogo = ecoadm_resolver_pev_catalogo($conn, ecoadm_pev_padrao_nome());
    if ($idCatalogo > 0) {
        return $idCatalogo;
    }

    $res = @$conn->query("SELECT id_pev FROM ponto_entrega ORDER BY id_pev ASC LIMIT 1");
    if ($res && ($row = $res->fetch_assoc())) {
        $res->free();
        return (int) ($row["id_pev"] ?? 0);
    }

    return 0;
}

function ecocoletas_seed_contar(mysqli $conn): int
{
    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return 0;
    }

    $like = "%" . ECOCOLETAS_SEED_EMAIL_SUFFIX;
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS c
         FROM agendamento_coleta_morador a
         INNER JOIN usuario u ON u.id_usuario = a.id_usuario
         WHERE u.email LIKE ?"
    );
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("s", $like);
    $stmt->execute();
    $c = 0;
    $stmt->bind_result($c);
    $stmt->fetch();
    $stmt->close();
    return (int) $c;
}

function ecocoletas_seed_remover(mysqli $conn): int
{
    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return 0;
    }

    $like = "%" . ECOCOLETAS_SEED_EMAIL_SUFFIX;
    $stmt = $conn->prepare(
        "DELETE a FROM agendamento_coleta_morador a
         INNER JOIN usuario u ON u.id_usuario = a.id_usuario
         WHERE u.email LIKE ?"
    );
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("s", $like);
    $stmt->execute();
    $removidos = $stmt->affected_rows;
    $stmt->close();
    ecoadm_invalidar_cache_agendamento();
    return max(0, $removidos);
}

function ecocoletas_sincronizar_seed(mysqli $conn, bool $apenas_faltantes = true): array
{
    ecoadm_garantir_schema_integracao($conn);

    $stats = ["inseridos" => 0, "total" => 0, "id_pev" => 0];

    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return $stats;
    }

    $idPev = ecocoletas_seed_resolver_pev($conn);
    $stats["id_pev"] = $idPev;
    $temColPev = ecoadm_agendamento_tem_coluna($conn, "id_pev");

    $like = "%" . ECOCOLETAS_SEED_EMAIL_SUFFIX;
    $sql = "SELECT u.id_usuario, u.nome, u.email
            FROM usuario u
            WHERE u.tipo_usuario = 'morador' AND u.email LIKE ?
            ORDER BY u.id_usuario ASC
            LIMIT ?";
    $limite = ECOCOLETAS_SEED_TOTAL;
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return $stats;
    }
    $stmt->bind_param("si", $like, $limite);
    if (!$stmt->execute()) {
        $stmt->close();
        return $stats;
    }

    $usuarios = ecocoleta_stmt_fetch_all_assoc($stmt);
    $stmt->close();

    $hoje = new DateTimeImmutable("today");
    $existentes = ecocoletas_seed_contar($conn);
    $pularExistentes = $apenas_faltantes && $existentes >= ECOCOLETAS_SEED_TOTAL;

    foreach ($usuarios as $idx => $row) {
        $idUsuario = (int) ($row["id_usuario"] ?? 0);
        if ($idUsuario <= 0) {
            continue;
        }

        $params = ecocoletas_seed_parametros($idx, $hoje);
        $dataColeta = $params["data"];
        $slot = $params["slot"];
        $status = $params["status"];
        $tipo = $params["tipo"];

        $nomePev = $idPev > 0 ? ecoadm_nome_pev_por_id($conn, $idPev) : "";
        $resp = ecoadm_rotulo_responsavel($tipo, $nomePev);

        $idAgendamento = ecocoletas_seed_buscar_agendamento($conn, $idUsuario);
        if ($idAgendamento > 0) {
            if ($pularExistentes && $idx >= ECOCOLETAS_SEED_HOJE_QTD) {
                if ($temColPev && $idPev > 0) {
                    $nomePevOnly = ecoadm_nome_pev_por_id($conn, $idPev);
                    $respOnly = ecoadm_rotulo_responsavel($tipo, $nomePevOnly);
                    $idPevBind = $idPev;
                    $updPev = $conn->prepare(
                        "UPDATE agendamento_coleta_morador
                         SET id_pev = ?, responsavel = ? WHERE id_agendamento = ?"
                    );
                    if ($updPev) {
                        $updPev->bind_param("isi", $idPevBind, $respOnly, $idAgendamento);
                        $updPev->execute();
                        $updPev->close();
                    }
                }
                continue;
            }
            if ($temColPev) {
                $upd = $conn->prepare(
                    "UPDATE agendamento_coleta_morador
                     SET data_coleta = ?, slot_ordem = ?, status_coleta = ?, tipo_coleta = ?,
                         responsavel = ?, id_pev = ?
                     WHERE id_agendamento = ?"
                );
                if (!$upd) {
                    continue;
                }
                $idPevBind = $idPev > 0 ? $idPev : null;
                $upd->bind_param("sisssii", $dataColeta, $slot, $status, $tipo, $resp, $idPevBind, $idAgendamento);
            } else {
                $upd = $conn->prepare(
                    "UPDATE agendamento_coleta_morador
                     SET data_coleta = ?, slot_ordem = ?, status_coleta = ?, tipo_coleta = ?, responsavel = ?
                     WHERE id_agendamento = ?"
                );
                if (!$upd) {
                    continue;
                }
                $upd->bind_param("sisssi", $dataColeta, $slot, $status, $tipo, $resp, $idAgendamento);
            }
            if ($upd->execute() && $upd->affected_rows > 0) {
                $stats["inseridos"]++;
            }
            $upd->close();
            continue;
        }

        if ($pularExistentes) {
            continue;
        }

        if ($temColPev) {
            $ins = $conn->prepare(
                "INSERT INTO agendamento_coleta_morador
                 (id_usuario, data_coleta, slot_ordem, status_coleta, tipo_coleta, responsavel, id_pev)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            if (!$ins) {
                continue;
            }
            $idPevBind = $idPev > 0 ? $idPev : null;
            $ins->bind_param("isisssi", $idUsuario, $dataColeta, $slot, $status, $tipo, $resp, $idPevBind);
        } else {
            $ins = $conn->prepare(
                "INSERT INTO agendamento_coleta_morador
                 (id_usuario, data_coleta, slot_ordem, status_coleta, tipo_coleta, responsavel)
                 VALUES (?, ?, ?, ?, ?, ?)"
            );
            if (!$ins) {
                continue;
            }
            $ins->bind_param("isisss", $idUsuario, $dataColeta, $slot, $status, $tipo, $resp);
        }

        if ($ins->execute()) {
            $stats["inseridos"]++;
        }
        $ins->close();
    }

    ecoseed_realinhar_ecoponto_padrao($conn);

    ecoadm_invalidar_cache_agendamento();
    $stats["total"] = ecocoletas_seed_contar($conn);
    return $stats;
}
