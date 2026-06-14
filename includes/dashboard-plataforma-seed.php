<?php

declare(strict_types=1);

require_once __DIR__ . "/conexao.php";
require_once __DIR__ . "/admin-ecoponto-data.php";
require_once __DIR__ . "/dashboard-plataforma.php";

function ecoplat_dashboard_sincronizar_seed(mysqli $conn, bool $forcar = false): array
{
    $stats = ["inseridos" => 0, "itens" => 0, "materiais" => 0];

    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return $stats;
    }

    ecoadm_garantir_schema_integracao($conn);
    ecoplat_dashboard_garantir_materiais($conn, $stats);

    $total = ecoplat_dashboard_contar_entregas($conn);
    $minimo = 80;

    if (!$forcar && $total >= $minimo) {
        return $stats;
    }

    if ($forcar && $total > 0) {
        ecoplat_dashboard_limpar_seed($conn);
        $total = 0;
    }

    $usuarios = ecoplat_dashboard_listar_ids_usuario($conn);
    $materiais = ecoplat_dashboard_mapa_materiais($conn);
    $idPevPadrao = function_exists("ecoseed_pev_padrao_id")
        ? ecoseed_pev_padrao_id($conn)
        : (function_exists("ecoadm_resolver_pev_catalogo")
            ? ecoadm_resolver_pev_catalogo($conn, ecoadm_pev_padrao_nome())
            : 0);

    if ($usuarios === [] || $idPevPadrao <= 0 || $materiais === []) {
        return $stats;
    }

    $pesosMaterial = [
        "plastico" => 1.35,
        "papel" => 1.0,
        "vidro" => 0.85,
        "metal" => 0.7,
        "organico" => 1.1,
    ];

    $metaEntrega = 120 - $total;
    if ($forcar) {
        $metaEntrega = 120;
    }
    $metaEntrega = max(0, min(200, $metaEntrega));

    $temItens = ecocoleta_tabela_existe($conn, "item_entrega");

    for ($i = 0; $i < $metaEntrega; $i++) {
        $uid = $usuarios[$i % count($usuarios)];
        $idPev = $idPevPadrao;
        $diasAtras = random_int(0, 180);
        $dataEntrega = date("Y-m-d H:i:s", strtotime("-{$diasAtras} days -" . random_int(0, 8) . " hours"));
        $pesoTotal = 0.0;

        $stmtE = $conn->prepare(
            "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario, id_pev)
             VALUES (?, 0, ?, ?, ?)"
        );
        if (!$stmtE) {
            continue;
        }
        $pontos = random_int(15, 120);
        $stmtE->bind_param("siii", $dataEntrega, $pontos, $uid, $idPev);
        if (!$stmtE->execute()) {
            $stmtE->close();
            continue;
        }
        $idEntrega = (int) $conn->insert_id;
        $stmtE->close();
        $stats["inseridos"]++;

        if (!$temItens) {
            $pesoTotal = round(random_int(8, 45) + (random_int(0, 99) / 100), 2);
            $upd = $conn->prepare("UPDATE entrega SET peso_total = ? WHERE id_entrega = ?");
            if ($upd) {
                $upd->bind_param("di", $pesoTotal, $idEntrega);
                $upd->execute();
                $upd->close();
            }
            continue;
        }

        $slugs = array_keys($materiais);
        shuffle($slugs);
        $qtdItens = random_int(2, min(4, count($slugs)));

        for ($j = 0; $j < $qtdItens; $j++) {
            $slug = $slugs[$j];
            $idMat = $materiais[$slug] ?? 0;
            if ($idMat <= 0) {
                continue;
            }
            $fator = $pesosMaterial[$slug] ?? 1.0;
            $peso = round((random_int(3, 18) + random_int(0, 99) / 100) * $fator, 2);
            $pesoTotal += $peso;

            $stmtI = $conn->prepare(
                "INSERT INTO item_entrega (quantidade, peso, id_entrega, id_material) VALUES (1, ?, ?, ?)"
            );
            if (!$stmtI) {
                continue;
            }
            $stmtI->bind_param("dii", $peso, $idEntrega, $idMat);
            if ($stmtI->execute()) {
                $stats["itens"]++;
            }
            $stmtI->close();
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

    return $stats;
}

function ecoplat_dashboard_limpar_seed(mysqli $conn): void
{
    if (ecocoleta_tabela_existe($conn, "item_entrega")) {
        @$conn->query(
            "DELETE ie FROM item_entrega ie
             INNER JOIN entrega e ON e.id_entrega = ie.id_entrega
             WHERE e.pontos_gerados BETWEEN 15 AND 120"
        );
    }
    @$conn->query("DELETE FROM entrega WHERE pontos_gerados BETWEEN 15 AND 120");
}

function ecoplat_dashboard_garantir_materiais(mysqli $conn, array &$stats): void
{
    if (!ecocoleta_tabela_existe($conn, "material")) {
        return;
    }

    $res = @$conn->query("SELECT COUNT(*) AS c FROM material");
    $total = 0;
    if ($res) {
        $row = $res->fetch_assoc();
        $total = (int) ($row["c"] ?? 0);
        $res->free();
    }

    if ($total > 0) {
        return;
    }

    @$conn->query(
        "INSERT INTO material (descricao, tipo_material) VALUES
         ('Plástico', 'plastico'),
         ('Papel', 'papel'),
         ('Vidro', 'vidro'),
         ('Metal', 'metal'),
         ('Orgânico', 'organico')"
    );
    $stats["materiais"] = 5;
}

function ecoplat_dashboard_mapa_materiais(mysqli $conn): array
{
    $map = [];
    if (!ecocoleta_tabela_existe($conn, "material")) {
        return $map;
    }

    $res = @$conn->query("SELECT id_material, tipo_material, descricao FROM material");
    if (!$res) {
        return $map;
    }

    while ($row = $res->fetch_assoc()) {
        $slug = ecoadm_material_slug((string) ($row["tipo_material"] ?? $row["descricao"] ?? ""));
        $map[$slug] = (int) ($row["id_material"] ?? 0);
    }
    $res->free();

    return $map;
}

function ecoplat_dashboard_listar_ids_usuario(mysqli $conn): array
{
    $ids = [];
    $res = @$conn->query(
        "SELECT id_usuario FROM usuario
         WHERE tipo_usuario IN ('morador', 'cooperativa')
         ORDER BY id_usuario ASC LIMIT 80"
    );
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $ids[] = (int) ($row["id_usuario"] ?? 0);
        }
        $res->free();
    }
    return array_values(array_filter($ids));
}

function ecoplat_dashboard_listar_ids_pev(mysqli $conn): array
{
    $ids = [];
    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return $ids;
    }
    $res = @$conn->query("SELECT id_pev FROM ponto_entrega ORDER BY id_pev ASC LIMIT 30");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $ids[] = (int) ($row["id_pev"] ?? 0);
        }
        $res->free();
    }
    return array_values(array_filter($ids));
}
