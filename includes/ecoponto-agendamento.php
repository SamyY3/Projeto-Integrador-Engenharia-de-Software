<?php

declare(strict_types=1);

require_once __DIR__ . "/conexao.php";
require_once __DIR__ . "/ecopontos-repository.php";
require_once __DIR__ . "/geocode-resolver.php";

function ecoponto_tipos_residuo_labels(): array
{
    return [
        "plastico" => "Plástico",
        "papel" => "Papel",
        "vidro" => "Vidro",
        "metal" => "Metal",
        "organico" => "Orgânico",
        "eletronico" => "Eletrônico",
        "misto" => "Resíduo",
        "madeira" => "Madeira",
    ];
}

function ecoponto_normalizar_tipo_residuo(string $tipo): string
{
    $tipo = strtolower(trim($tipo));
    $labels = ecoponto_tipos_residuo_labels();
    return array_key_exists($tipo, $labels) ? $tipo : "";
}

function ecoponto_normalizar_tipos_residuo(string $raw): array
{
    $out = [];
    foreach (preg_split("/[,;]+/", strtolower(trim($raw))) as $part) {
        $t = ecoponto_normalizar_tipo_residuo(trim((string) $part));
        if ($t !== "" && !in_array($t, $out, true)) {
            $out[] = $t;
        }
    }
    return $out;
}

function ecoponto_tipos_residuo_para_storage(array $tipos): string
{
    return implode(",", array_values(array_unique($tipos)));
}

function ecoponto_pev_aceita_todos_residuos(mysqli $conn, int $idPev, array $tipos): bool
{
    if ($tipos === []) {
        return false;
    }
    foreach ($tipos as $tipo) {
        if (!ecoponto_pev_aceita_residuo($conn, $idPev, $tipo)) {
            return false;
        }
    }
    return true;
}

function ecoponto_garantir_schema_materiais(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return;
    }
    ecopontos_garantir_schema($conn);
    if (!ecopontos_coluna_existe($conn, "materiais_aceitos_json")) {
        @$conn->query(
            "ALTER TABLE ponto_entrega
             ADD COLUMN materiais_aceitos_json TEXT NULL DEFAULT NULL AFTER responsavel"
        );
    }
}

function ecoponto_garantir_coluna_agendamento_residuo(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
        return;
    }
    require_once __DIR__ . "/admin-ecoponto-data.php";
    ecoadm_garantir_schema_integracao($conn);

    if (!ecoadm_agendamento_tem_coluna($conn, "tipo_residuo")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN tipo_residuo VARCHAR(128) NULL DEFAULT NULL AFTER id_pev"
        );
    } else {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             MODIFY COLUMN tipo_residuo VARCHAR(128) NULL DEFAULT NULL"
        );
    }
}

function ecoponto_materiais_padrao_pev(string $catalogId, int $idPev): array
{
    $base = ["plastico", "papel", "vidro", "metal"];
    $extras = ["organico", "eletronico", "misto", "madeira"];
    $seed = abs((int) crc32($catalogId !== "" ? $catalogId : ("pev-" . $idPev)));

    $materiais = $base;
    foreach ($extras as $idx => $tipo) {
        if (($seed >> ($idx % 8)) & 1) {
            $materiais[] = $tipo;
        }
    }

    $extra = $extras[$idPev % count($extras)];
    if (!in_array($extra, $materiais, true)) {
        $materiais[] = $extra;
    }

    return array_values(array_unique($materiais));
}

function ecoponto_sincronizar_materiais_pev(mysqli $conn, int $idPev): array
{
    ecoponto_garantir_schema_materiais($conn);
    if ($idPev <= 0) {
        return ecoponto_materiais_padrao_pev("", 0);
    }

    $catalogId = "";
    $jsonAtual = "";
    $stmt = $conn->prepare(
        "SELECT catalog_id, materiais_aceitos_json FROM ponto_entrega WHERE id_pev = ? LIMIT 1"
    );
    if ($stmt) {
        $stmt->bind_param("i", $idPev);
        if ($stmt->execute()) {
            $row = ecocoleta_stmt_fetch_one_assoc($stmt);
            if ($row) {
                $catalogId = trim((string) ($row["catalog_id"] ?? ""));
                $jsonAtual = trim((string) ($row["materiais_aceitos_json"] ?? ""));
            }
        }
        $stmt->close();
    }

    if ($jsonAtual !== "") {
        $decoded = json_decode($jsonAtual, true);
        if (is_array($decoded) && $decoded !== []) {
            $out = [];
            foreach ($decoded as $item) {
                $t = ecoponto_normalizar_tipo_residuo((string) $item);
                if ($t !== "") {
                    $out[] = $t;
                }
            }
            if ($out !== []) {
                return array_values(array_unique($out));
            }
        }
    }

    $materiais = ecoponto_materiais_padrao_pev($catalogId, $idPev);
    $json = json_encode($materiais, JSON_UNESCAPED_UNICODE);
    $up = $conn->prepare(
        "UPDATE ponto_entrega SET materiais_aceitos_json = ? WHERE id_pev = ? LIMIT 1"
    );
    if ($up) {
        $up->bind_param("si", $json, $idPev);
        $up->execute();
        $up->close();
    }

    return $materiais;
}

function ecoponto_haversine_km(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $r = 6371.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2
        + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

function ecoponto_coords_usuario(mysqli $conn, int $idUsuario): array
{
    $rua = "";
    $bairro = "";
    $cidade = "";

    if ($idUsuario > 0) {
        $hasCidade = false;
        $hasNumero = false;
        $q = @$conn->query("SHOW COLUMNS FROM usuario");
        $cols = [];
        if ($q) {
            while ($r = $q->fetch_assoc()) {
                $cols[$r["Field"]] = true;
            }
            $q->free();
        }
        $hasCidade = !empty($cols["cidade"]);
        $sql = "SELECT COALESCE(r.nome_rua, '') AS rua, COALESCE(b.nome_bairro, '') AS bairro";
        if ($hasCidade) {
            $sql .= ", COALESCE(u.cidade, '') AS cidade";
        }
        $sql .= " FROM usuario u
                  LEFT JOIN rua r ON r.id_rua = u.id_rua
                  LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
                  WHERE u.id_usuario = ? LIMIT 1";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("i", $idUsuario);
            if ($stmt->execute()) {
                $row = ecocoleta_stmt_fetch_one_assoc($stmt);
                if ($row) {
                    $rua = trim((string) ($row["rua"] ?? ""));
                    $bairro = trim((string) ($row["bairro"] ?? ""));
                    $cidade = $hasCidade ? trim((string) ($row["cidade"] ?? "")) : "";
                }
            }
            $stmt->close();
        }
    }

    $hit = ecogeocode_resolver_endereco($rua, $bairro, $cidade);
    if ($hit) {
        return [
            "lat" => (float) ($hit["lat"] ?? 0),
            "lng" => (float) ($hit["lon"] ?? $hit["lng"] ?? 0),
            "precision" => (string) ($hit["precision"] ?? "endereco"),
        ];
    }

    return ["lat" => -7.2153, "lng" => -39.3153, "precision" => "padrao"];
}

function ecoponto_listar_para_morador(mysqli $conn, int $idUsuario): array
{
    ecoponto_garantir_schema_materiais($conn);

    if (ecopontos_contar_com_catalog_id($conn) < 3) {
        ecopontos_sincronizar_catalogo($conn, true);
    }

    $coords = ecoponto_coords_usuario($conn, $idUsuario);
    $userLat = (float) $coords["lat"];
    $userLng = (float) $coords["lng"];

    $lista = [];
    foreach (ecopontos_listar_do_banco($conn) as $pev) {
        $idPev = (int) ($pev["id_pev"] ?? 0);
        if ($idPev <= 0) {
            continue;
        }

        $status = strtolower(trim((string) ($pev["status"] ?? "ativo")));
        $lat = isset($pev["lat"]) ? (float) $pev["lat"] : 0.0;
        $lng = isset($pev["lng"]) ? (float) $pev["lng"] : 0.0;
        $distancia = null;
        if ($lat !== 0.0 && $lng !== 0.0) {
            $distancia = round(ecoponto_haversine_km($userLat, $userLng, $lat, $lng), 2);
        }

        $materiais = ecoponto_sincronizar_materiais_pev($conn, $idPev);

        $lista[] = [
            "id_pev" => $idPev,
            "id" => (string) ($pev["id"] ?? ("pev-" . $idPev)),
            "name" => (string) ($pev["name"] ?? "EcoPonto"),
            "address" => (string) ($pev["address"] ?? ""),
            "city" => (string) ($pev["city"] ?? ""),
            "bairro" => (string) ($pev["bairro"] ?? ""),
            "lat" => $lat,
            "lng" => $lng,
            "status" => $status,
            "distancia_km" => $distancia,
            "distancia_fmt" => $distancia !== null
                ? ($distancia < 1
                    ? number_format((int) round($distancia * 1000), 0, ",", ".") . " m"
                    : number_format($distancia, 1, ",", ".") . " km")
                : "—",
            "materiais_aceitos" => $materiais,
            "ativo" => $status !== "manutencao",
        ];
    }

    usort($lista, static function (array $a, array $b): int {
        $da = $a["distancia_km"];
        $db = $b["distancia_km"];
        if ($da === null && $db === null) {
            return strcmp((string) $a["name"], (string) $b["name"]);
        }
        if ($da === null) {
            return 1;
        }
        if ($db === null) {
            return -1;
        }
        if ($da === $db) {
            return strcmp((string) $a["name"], (string) $b["name"]);
        }
        return $da <=> $db;
    });

    return $lista;
}

function ecoponto_escolher_sugerido(array $lista, string $tipoResiduo = ""): int
{
    $tipo = ecoponto_normalizar_tipo_residuo($tipoResiduo);
    foreach ($lista as $pev) {
        if (empty($pev["ativo"])) {
            continue;
        }
        if ($tipo !== "") {
            $aceitos = $pev["materiais_aceitos"] ?? [];
            if (!is_array($aceitos) || !in_array($tipo, $aceitos, true)) {
                continue;
            }
        }
        return (int) ($pev["id_pev"] ?? 0);
    }
    return 0;
}

function ecoponto_encontrar_para_residuo(array $lista, string $tipoResiduo, int $excetoId = 0): ?array
{
    $tipo = ecoponto_normalizar_tipo_residuo($tipoResiduo);
    if ($tipo === "") {
        return null;
    }
    foreach ($lista as $pev) {
        $id = (int) ($pev["id_pev"] ?? 0);
        if ($id <= 0 || $id === $excetoId || empty($pev["ativo"])) {
            continue;
        }
        $aceitos = $pev["materiais_aceitos"] ?? [];
        if (is_array($aceitos) && in_array($tipo, $aceitos, true)) {
            return $pev;
        }
    }
    return null;
}

function ecoponto_pev_aceita_residuo(mysqli $conn, int $idPev, string $tipoResiduo): bool
{
    $tipo = ecoponto_normalizar_tipo_residuo($tipoResiduo);
    if ($idPev <= 0 || $tipo === "") {
        return false;
    }
    $materiais = ecoponto_sincronizar_materiais_pev($conn, $idPev);
    return in_array($tipo, $materiais, true);
}

function ecoponto_payload_agendamento(mysqli $conn, int $idUsuario, string $tipoResiduo = ""): array
{
    $lista = ecoponto_listar_para_morador($conn, $idUsuario);
    $coords = ecoponto_coords_usuario($conn, $idUsuario);
    $sugerido = ecoponto_escolher_sugerido($lista, $tipoResiduo);

    return [
        "ecopontos" => $lista,
        "sugerido_id_pev" => $sugerido,
        "usuario_coords" => $coords,
        "tipos_residuo" => ecoponto_tipos_residuo_labels(),
    ];
}
