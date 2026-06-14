<?php

declare(strict_types=1);

require_once __DIR__ . "/conexao.php";

function ecopontos_carregar_catalogo(): array
{
    $path = __DIR__ . "/ecopontos-catalog-data.php";
    if (!is_file($path)) {
        return [];
    }
    $catalog = require $path;
    return is_array($catalog) ? $catalog : [];
}

function ecopontos_coluna_existe(mysqli $conn, string $coluna): bool
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        $res = @$conn->query("SHOW COLUMNS FROM ponto_entrega");
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $cache[$row["Field"]] = true;
            }
            $res->free();
        }
    }
    return !empty($cache[$coluna]);
}

function ecopontos_garantir_schema(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return;
    }

    $alters = [
        "catalog_id" => "ADD COLUMN catalog_id VARCHAR(64) NULL DEFAULT NULL AFTER id_pev",
        "latitude" => "ADD COLUMN latitude DECIMAL(10, 7) NULL DEFAULT NULL AFTER endereco",
        "longitude" => "ADD COLUMN longitude DECIMAL(10, 7) NULL DEFAULT NULL AFTER latitude",
        "cidade" => "ADD COLUMN cidade VARCHAR(120) NULL DEFAULT NULL AFTER longitude",
        "bairro_label" => "ADD COLUMN bairro_label VARCHAR(100) NULL DEFAULT NULL AFTER cidade",
        "status_operacao" => "ADD COLUMN status_operacao ENUM('ativo','manutencao') NOT NULL DEFAULT 'ativo' AFTER bairro_label",
        "capacidade_pct" => "ADD COLUMN capacidade_pct TINYINT UNSIGNED NOT NULL DEFAULT 70 AFTER status_operacao",
        "responsavel" => "ADD COLUMN responsavel VARCHAR(120) NULL DEFAULT NULL AFTER capacidade_pct",
    ];

    foreach ($alters as $col => $sqlPart) {
        if (!ecopontos_coluna_existe($conn, $col)) {
            @$conn->query("ALTER TABLE ponto_entrega {$sqlPart}");
        }
    }

    if (ecopontos_coluna_existe($conn, "catalog_id")) {
        $idx = @$conn->query("SHOW INDEX FROM ponto_entrega WHERE Key_name = 'uq_pev_catalog_id'");
        if ($idx && $idx->num_rows === 0) {
            @$conn->query(
                "ALTER TABLE ponto_entrega ADD UNIQUE KEY uq_pev_catalog_id (catalog_id)"
            );
        }
        if ($idx) {
            $idx->free();
        }
    }
}

function ecopontos_item_catalogo_para_db(array $item): array
{
    $lat = isset($item["lat"]) ? (float) $item["lat"] : null;
    $lng = isset($item["lng"]) ? (float) $item["lng"] : null;
    if ($lat !== null && (abs($lat) < 0.000001 || abs($lat) > 90)) {
        $lat = null;
    }
    if ($lng !== null && (abs($lng) < 0.000001 || abs($lng) > 180)) {
        $lng = null;
    }

    $status = strtolower(trim((string) ($item["status"] ?? "ativo")));
    if ($status !== "manutencao") {
        $status = "ativo";
    }

    $cap = (int) ($item["capacidade"] ?? 70);
    if ($cap < 0) {
        $cap = 0;
    }
    if ($cap > 100) {
        $cap = 100;
    }

    return [
        "catalog_id" => trim((string) ($item["id"] ?? "")),
        "nome_ponto" => trim((string) ($item["name"] ?? "EcoPonto")),
        "endereco" => trim((string) ($item["address"] ?? "")),
        "cidade" => trim((string) ($item["city"] ?? "")),
        "bairro_label" => trim((string) ($item["bairro"] ?? "")),
        "latitude" => $lat,
        "longitude" => $lng,
        "status_operacao" => $status,
        "capacidade_pct" => $cap,
        "responsavel" => trim((string) ($item["responsavel"] ?? "")),
    ];
}

function ecopontos_sincronizar_catalogo(mysqli $conn, bool $apenas_faltantes = true): array
{
    ecopontos_garantir_schema($conn);
    $catalog = ecopontos_carregar_catalogo();
    $stats = [
        "inseridos" => 0,
        "atualizados" => 0,
        "total_catalogo" => count($catalog),
        "total_banco" => 0,
    ];

    if (!ecocoleta_tabela_existe($conn, "ponto_entrega") || $catalog === []) {
        return $stats;
    }

    foreach ($catalog as $item) {
        if (!is_array($item)) {
            continue;
        }
        $row = ecopontos_item_catalogo_para_db($item);
        if ($row["catalog_id"] === "" || $row["nome_ponto"] === "") {
            continue;
        }

        $idExistente = 0;
        $stmt = $conn->prepare(
            "SELECT id_pev FROM ponto_entrega WHERE catalog_id = ? LIMIT 1"
        );
        if ($stmt) {
            $stmt->bind_param("s", $row["catalog_id"]);
            $stmt->execute();
            $stmt->bind_result($idExistente);
            $stmt->fetch();
            $stmt->close();
        }

        if ($idExistente > 0) {
            if ($apenas_faltantes) {
                continue;
            }
            $sql = "UPDATE ponto_entrega SET
                nome_ponto = ?, endereco = ?, cidade = ?, bairro_label = ?,
                latitude = ?, longitude = ?, status_operacao = ?, capacidade_pct = ?, responsavel = ?
                WHERE id_pev = ? LIMIT 1";
            $stmtUp = $conn->prepare($sql);
            if ($stmtUp) {
                $stmtUp->bind_param(
                    "ssssddisis",
                    $row["nome_ponto"],
                    $row["endereco"],
                    $row["cidade"],
                    $row["bairro_label"],
                    $row["latitude"],
                    $row["longitude"],
                    $row["status_operacao"],
                    $row["capacidade_pct"],
                    $row["responsavel"],
                    $idExistente
                );
                if ($stmtUp->execute()) {
                    $stats["atualizados"]++;
                }
                $stmtUp->close();
            }
            continue;
        }

        $sql = "INSERT INTO ponto_entrega (
            catalog_id, nome_ponto, endereco, cidade, bairro_label,
            latitude, longitude, status_operacao, capacidade_pct, responsavel
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmtIns = $conn->prepare($sql);
        if (!$stmtIns) {
            continue;
        }
        $stmtIns->bind_param(
            "sssssddsis",
            $row["catalog_id"],
            $row["nome_ponto"],
            $row["endereco"],
            $row["cidade"],
            $row["bairro_label"],
            $row["latitude"],
            $row["longitude"],
            $row["status_operacao"],
            $row["capacidade_pct"],
            $row["responsavel"]
        );
        if ($stmtIns->execute()) {
            $stats["inseridos"]++;
        }
        $stmtIns->close();
    }

    $res = @$conn->query("SELECT COUNT(*) AS c FROM ponto_entrega");
    if ($res) {
        $r = $res->fetch_assoc();
        $stats["total_banco"] = (int) ($r["c"] ?? 0);
        $res->free();
    }

    return $stats;
}

function ecopontos_ativar_todos(mysqli $conn): int
{
    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return 0;
    }

    ecopontos_garantir_schema($conn);

    if (!ecopontos_coluna_existe($conn, "status_operacao")) {
        return 0;
    }

    @$conn->query(
        "UPDATE ponto_entrega SET status_operacao = 'ativo'
         WHERE status_operacao IS NULL OR status_operacao <> 'ativo'"
    );

    return (int) $conn->affected_rows;
}

function ecopontos_garantir_todos_ativos(mysqli $conn): array
{
    $inseridos = ecopontos_sincronizar_catalogo($conn, true);
    $atualizados = ecopontos_sincronizar_catalogo($conn, false);
    $ativados = ecopontos_ativar_todos($conn);
    $lista = ecopontos_listar_do_banco($conn);
    $resumo = ecopontos_calcular_resumo($lista);

    return [
        "inseridos" => (int) ($inseridos["inseridos"] ?? 0),
        "atualizados" => (int) ($atualizados["atualizados"] ?? 0),
        "ativados" => $ativados,
        "total_banco" => (int) ($resumo["total"] ?? count($lista)),
        "ativos" => (int) ($resumo["ativos"] ?? 0),
    ];
}

function ecopontos_contar_com_catalog_id(mysqli $conn): int
{
    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return 0;
    }
    ecopontos_garantir_schema($conn);
    if (!ecopontos_coluna_existe($conn, "catalog_id")) {
        return 0;
    }
    $res = @$conn->query(
        "SELECT COUNT(*) AS c FROM ponto_entrega WHERE catalog_id IS NOT NULL AND catalog_id <> ''"
    );
    if (!$res) {
        return 0;
    }
    $row = $res->fetch_assoc();
    $res->free();
    return (int) ($row["c"] ?? 0);
}

function ecopontos_listar_do_banco(mysqli $conn): array
{
    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return [];
    }

    ecopontos_garantir_schema($conn);

    $cols = "id_pev, nome_ponto, endereco";
    $extras = [
        "catalog_id",
        "latitude",
        "longitude",
        "cidade",
        "bairro_label",
        "status_operacao",
        "capacidade_pct",
        "responsavel",
    ];
    foreach ($extras as $col) {
        if (ecopontos_coluna_existe($conn, $col)) {
            $cols .= ", {$col}";
        }
    }

    $lista = [];
    $res = @$conn->query("SELECT {$cols} FROM ponto_entrega ORDER BY nome_ponto ASC");
    if (!$res) {
        return [];
    }

    while ($row = $res->fetch_assoc()) {
        $lista[] = ecopontos_formatar_resposta($row);
    }
    $res->free();

    return $lista;
}

function ecopontos_formatar_resposta(array $row): array
{
    $idPev = (int) ($row["id_pev"] ?? 0);
    $catalogId = trim((string) ($row["catalog_id"] ?? ""));
    $lat = isset($row["latitude"]) && $row["latitude"] !== null && $row["latitude"] !== ""
        ? (float) $row["latitude"]
        : null;
    $lng = isset($row["longitude"]) && $row["longitude"] !== null && $row["longitude"] !== ""
        ? (float) $row["longitude"]
        : null;

    $bairro = trim((string) ($row["bairro_label"] ?? ""));
    if ($bairro === "" && preg_match('/^([^,]+)/', (string) ($row["endereco"] ?? ""), $m)) {
        $bairro = trim($m[1]);
    }

    $status = strtolower(trim((string) ($row["status_operacao"] ?? "ativo")));
    if ($status !== "manutencao") {
        $status = "ativo";
    }

    $resp = trim((string) ($row["responsavel"] ?? ""));
    if ($resp === "") {
        $resp = "—";
    }

    return [
        "id_pev" => $idPev,
        "id" => $catalogId !== "" ? $catalogId : ("pev-" . $idPev),
        "catalog_id" => $catalogId,
        "name" => trim((string) ($row["nome_ponto"] ?? "EcoPonto")),
        "address" => trim((string) ($row["endereco"] ?? "")),
        "city" => trim((string) ($row["cidade"] ?? "")),
        "bairro" => $bairro,
        "lat" => $lat,
        "lng" => $lng,
        "status" => $status,
        "capacidade" => (int) ($row["capacidade_pct"] ?? 70),
        "responsavel" => $resp,
    ];
}

function ecopontos_calcular_resumo(array $lista): array
{
    $ativos = 0;
    $manutencao = 0;
    foreach ($lista as $item) {
        if (($item["status"] ?? "") === "manutencao") {
            $manutencao++;
        } else {
            $ativos++;
        }
    }
    return [
        "total" => count($lista),
        "ativos" => $ativos,
        "manutencao" => $manutencao,
    ];
}

function ecopontos_salvar(mysqli $conn, array $input): array
{
    ecopontos_garantir_schema($conn);

    $idPev = (int) ($input["id_pev"] ?? 0);
    $catalogId = trim((string) ($input["catalog_id"] ?? $input["id"] ?? ""));
    $nome = trim((string) ($input["name"] ?? $input["nome_ponto"] ?? ""));
    $endereco = trim((string) ($input["address"] ?? $input["endereco"] ?? ""));
    $cidade = trim((string) ($input["city"] ?? $input["cidade"] ?? ""));
    $bairro = trim((string) ($input["bairro"] ?? $input["bairro_label"] ?? ""));
    $responsavel = trim((string) ($input["responsavel"] ?? ""));
    if ($responsavel === "—") {
        $responsavel = "";
    }

    $latRaw = $input["lat"] ?? $input["latitude"] ?? null;
    $lngRaw = $input["lng"] ?? $input["longitude"] ?? null;
    $lat = ($latRaw === "" || $latRaw === null) ? null : (float) $latRaw;
    $lng = ($lngRaw === "" || $lngRaw === null) ? null : (float) $lngRaw;

    $status = strtolower(trim((string) ($input["status"] ?? $input["status_operacao"] ?? "ativo")));
    if ($status !== "manutencao") {
        $status = "ativo";
    }

    $cap = (int) ($input["capacidade"] ?? $input["capacidade_pct"] ?? 70);
    $cap = max(0, min(100, $cap));

    if ($nome === "") {
        throw new InvalidArgumentException("Informe o nome do ecoponto.");
    }
    if ($endereco === "") {
        $endereco = $bairro !== "" && $cidade !== ""
            ? "{$bairro}, {$cidade}"
            : ($cidade !== "" ? $cidade : $nome);
    }

    if ($catalogId === "" && $idPev <= 0) {
        $catalogId = "pev-" . bin2hex(random_bytes(4));
    }

    if ($idPev > 0) {
        $sql = "UPDATE ponto_entrega SET
            catalog_id = COALESCE(NULLIF(?, ''), catalog_id),
            nome_ponto = ?, endereco = ?, cidade = ?, bairro_label = ?,
            latitude = ?, longitude = ?, status_operacao = ?, capacidade_pct = ?, responsavel = ?
            WHERE id_pev = ? LIMIT 1";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException("Erro ao preparar atualização.");
        }
        $stmt->bind_param(
            "sssssddisis",
            $catalogId,
            $nome,
            $endereco,
            $cidade,
            $bairro,
            $lat,
            $lng,
            $status,
            $cap,
            $responsavel,
            $idPev
        );
    } else {
        $sql = "INSERT INTO ponto_entrega (
            catalog_id, nome_ponto, endereco, cidade, bairro_label,
            latitude, longitude, status_operacao, capacidade_pct, responsavel
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException("Erro ao preparar inserção.");
        }
        $stmt->bind_param(
            "sssssddsis",
            $catalogId,
            $nome,
            $endereco,
            $cidade,
            $bairro,
            $lat,
            $lng,
            $status,
            $cap,
            $responsavel
        );
    }

    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new RuntimeException($err !== "" ? $err : "Falha ao salvar ecoponto.");
    }
    $stmt->close();

    if ($idPev <= 0) {
        $idPev = (int) $conn->insert_id;
    }

    $stmtOne = $conn->prepare(
        "SELECT id_pev, catalog_id, nome_ponto, endereco, cidade, bairro_label,
                latitude, longitude, status_operacao, capacidade_pct, responsavel
         FROM ponto_entrega WHERE id_pev = ? LIMIT 1"
    );
    if (!$stmtOne) {
        throw new RuntimeException("Salvo, mas não foi possível recarregar o registro.");
    }
    $stmtOne->bind_param("i", $idPev);
    $stmtOne->execute();
    $result = $stmtOne->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmtOne->close();

    if (!$row) {
        throw new RuntimeException("Registro não encontrado após salvar.");
    }

    return ecopontos_formatar_resposta($row);
}

function ecopontos_excluir(mysqli $conn, int $idPev): void
{
    if ($idPev <= 0) {
        throw new InvalidArgumentException("ID inválido.");
    }
    $stmt = $conn->prepare("DELETE FROM ponto_entrega WHERE id_pev = ? LIMIT 1");
    if (!$stmt) {
        throw new RuntimeException("Erro ao preparar exclusão.");
    }
    $stmt->bind_param("i", $idPev);
    if (!$stmt->execute() || $stmt->affected_rows < 1) {
        $stmt->close();
        throw new RuntimeException("Ecoponto não encontrado ou não pôde ser removido.");
    }
    $stmt->close();
}
