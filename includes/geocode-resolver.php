<?php

declare(strict_types=1);

function ecogeocode_http_get(string $url, array $headers): array
{
    if (function_exists("curl_init")) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => $headers,
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($body !== false && $code >= 200 && $code < 300) {
            return ["ok" => true, "body" => (string) $body, "code" => $code];
        }
        if ($body === false && $err !== "") {
            return ["ok" => false, "body" => "", "code" => $code > 0 ? $code : 0];
        }
    }

    $headerLines = implode("\r\n", $headers) . "\r\n";
    $ctx = stream_context_create([
        "http" => [
            "header" => $headerLines,
            "timeout" => 6,
            "ignore_errors" => true,
        ],
        "ssl" => [
            "verify_peer" => true,
            "verify_peer_name" => true,
        ],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false || $body === "") {
        return ["ok" => false, "body" => "", "code" => 0];
    }
    return ["ok" => true, "body" => (string) $body, "code" => 200];
}

function ecogeocode_strip_accents(string $texto): string
{
    $texto = mb_strtolower(trim($texto), "UTF-8");
    $de = ["á", "à", "â", "ã", "ä", "é", "è", "ê", "ë", "í", "ì", "î", "ï", "ó", "ò", "ô", "õ", "ö", "ú", "ù", "û", "ü", "ç", "ñ"];
    $para = ["a", "a", "a", "a", "a", "e", "e", "e", "e", "i", "i", "i", "i", "o", "o", "o", "o", "o", "u", "u", "u", "u", "c", "n"];
    return str_replace($de, $para, $texto);
}

function ecogeocode_normalizar_chave(string $texto): string
{
    $texto = ecogeocode_strip_accents($texto);
    $texto = preg_replace("/[^a-z0-9]+/", " ", $texto) ?? "";
    return trim($texto);
}

function ecogeocode_bairros_juazeiro(): array
{
    static $mapa = null;
    if ($mapa !== null) {
        return $mapa;
    }

    $centro = ["lat" => -7.2153, "lng" => -39.3153];
    $pontos = [
        "Centro" => ["lat" => -7.2127, "lng" => -39.3155],
        "Triangulo" => ["lat" => -7.2108, "lng" => -39.3188],
        "Romeirao" => ["lat" => -7.2195, "lng" => -39.3210],
        "Sao Miguel" => ["lat" => -7.2240, "lng" => -39.3125],
        "Horto" => ["lat" => -7.2085, "lng" => -39.3098],
        "Piraja" => ["lat" => -7.1972, "lng" => -39.3238],
        "Lagoa Seca" => ["lat" => -7.2468, "lng" => -39.3042],
        "Timbauba" => ["lat" => -7.2310, "lng" => -39.3280],
        "Alto do Moura" => ["lat" => -7.2055, "lng" => -39.3015],
        "Pedra dos Dias" => ["lat" => -7.2380, "lng" => -39.3175],
        "Aeroporto" => ["lat" => -7.2188, "lng" => -39.2705],
        "Bela Vista" => ["lat" => -7.2275, "lng" => -39.3060],
        "Calvary" => ["lat" => -7.2148, "lng" => -39.3245],
        "Carlao" => ["lat" => -7.2215, "lng" => -39.3295],
        "Cidade Universitaria" => ["lat" => -7.2138, "lng" => -39.3340],
        "Clientela" => ["lat" => -7.2095, "lng" => -39.3270],
        "Dom Jose" => ["lat" => -7.2175, "lng" => -39.3135],
        "Gameleira" => ["lat" => -7.2068, "lng" => -39.3205],
        "Joao XXIII" => ["lat" => -7.2335, "lng" => -39.3210],
        "Jose de Alencar" => ["lat" => -7.2288, "lng" => -39.3148],
        "Novo Juazeiro" => ["lat" => -7.2405, "lng" => -39.3090],
        "Salesianos" => ["lat" => -7.2162, "lng" => -39.3075],
        "Santa Luzia" => ["lat" => -7.2255, "lng" => -39.3195],
        "Socorro" => ["lat" => -7.2118, "lng" => -39.3225],
        "Tiradentes" => ["lat" => -7.2202, "lng" => -39.3165],
        "Serrinha" => ["lat" => -7.2268, "lng" => -39.3088],
    ];

    $mapa = [];
    foreach ($pontos as $nome => $coords) {
        $mapa[ecogeocode_normalizar_chave($nome)] = $coords;
    }
    $mapa["centro"] = $centro;

    return $mapa;
}

function ecogeocode_centros_cidade(): array
{
    return [
        "juazeiro do norte" => ["lat" => -7.2153, "lng" => -39.3153, "label" => "Juazeiro do Norte, CE"],
        "crato" => ["lat" => -7.2343, "lng" => -39.4097, "label" => "Crato, CE"],
        "barbalha" => ["lat" => -7.3124, "lng" => -39.3049, "label" => "Barbalha, CE"],
        "missao velha" => ["lat" => -7.2497, "lng" => -39.1437, "label" => "Missão Velha, CE"],
    ];
}

function ecogeocode_offset_bairro(string $bairro, float $latBase, float $lngBase): array
{
    $hash = crc32(ecogeocode_normalizar_chave($bairro));
    $angle = ($hash % 360) * M_PI / 180.0;
    $dist = 0.006 + (($hash >> 8) % 120) / 10000.0;
    return [
        "lat" => $latBase + $dist * cos($angle),
        "lng" => $lngBase + $dist * sin($angle) * 1.15,
    ];
}

function ecogeocode_variacoes_rua(string $rua): array
{
    $rua = trim($rua);
    if ($rua === "" || $rua === "—" || $rua === "-") {
        return [];
    }

    $vars = [$rua];
    $norm = ecogeocode_normalizar_chave($rua);

    if (strpos($norm, "eptacio") !== false || strpos($norm, "epitacio") !== false) {
        $vars[] = "Rua Epitacio Leite";
        $vars[] = "Epitacio Leite";
        $vars[] = "Rua Epitácio Leite";
    }
    if (strpos($norm, "rua ") !== 0) {
        $vars[] = "Rua " . $rua;
    }
    if (strpos($norm, "av ") !== 0 && strpos($norm, "avenida") === false) {
        $vars[] = "Avenida " . $rua;
    }

    $unicos = [];
    foreach ($vars as $v) {
        $v = trim($v);
        if ($v !== "" && !in_array($v, $unicos, true)) {
            $unicos[] = $v;
        }
    }
    return $unicos;
}

function ecogeocode_nominatim(string $q): array
{
    $url = "https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=br&q="
        . rawurlencode($q);
    $res = ecogeocode_http_get($url, [
        "User-Agent: EcoColeta/1.0 (educacional; localhost)",
        "Accept: application/json",
        "Accept-Language: pt-BR,pt;q=0.9",
    ]);
    if (!$res["ok"]) {
        return [];
    }
    $data = json_decode($res["body"], true);
    if (!is_array($data)) {
        return [];
    }
    $out = [];
    foreach ($data as $row) {
        if (!is_array($row)) {
            continue;
        }
        $lat = isset($row["lat"]) ? (string) $row["lat"] : "";
        $lon = isset($row["lon"]) ? (string) $row["lon"] : "";
        if ($lat === "" || $lon === "") {
            continue;
        }
        $out[] = [
            "lat" => $lat,
            "lon" => $lon,
            "display_name" => isset($row["display_name"]) ? (string) $row["display_name"] : "",
        ];
    }
    return $out;
}

function ecogeocode_photon(string $q): array
{
    $url = "https://photon.komoot.io/api/?q=" . rawurlencode($q) . "&limit=3&lang=pt";
    $res = ecogeocode_http_get($url, [
        "Accept: application/json",
        "User-Agent: EcoColeta/1.0",
    ]);
    if (!$res["ok"]) {
        return [];
    }
    $data = json_decode($res["body"], true);
    if (!is_array($data) || !isset($data["features"]) || !is_array($data["features"])) {
        return [];
    }
    $out = [];
    foreach ($data["features"] as $feature) {
        if (!is_array($feature)) {
            continue;
        }
        $coords = $feature["geometry"]["coordinates"] ?? null;
        if (!is_array($coords) || count($coords) < 2) {
            continue;
        }
        $lng = (float) $coords[0];
        $lat = (float) $coords[1];
        if (!is_finite($lat) || !is_finite($lng)) {
            continue;
        }
        $props = is_array($feature["properties"] ?? null) ? $feature["properties"] : [];
        $labelParts = array_filter([
            $props["name"] ?? "",
            $props["street"] ?? "",
            $props["city"] ?? "",
            $props["state"] ?? "",
        ], static fn ($v) => trim((string) $v) !== "");
        $out[] = [
            "lat" => (string) $lat,
            "lon" => (string) $lng,
            "display_name" => implode(", ", $labelParts),
        ];
    }
    return $out;
}

function ecogeocode_buscar_externo(string $q): ?array
{
    $q = trim($q);
    if ($q === "") {
        return null;
    }

    foreach ([ecogeocode_nominatim($q), ecogeocode_photon($q)] as $hits) {
        if ($hits === []) {
            continue;
        }
        $hit = $hits[0];
        return [
            "lat" => $hit["lat"],
            "lon" => $hit["lon"],
            "display_name" => (string) ($hit["display_name"] ?? $q),
            "precision" => "exato",
        ];
    }
    return null;
}

function ecogeocode_fallback_bairro(string $bairro, array $centroCidade, string $cidadeLabel): ?array
{
    if ($bairro === "" || $bairro === "—" || $bairro === "-") {
        return null;
    }

    $bairroChave = ecogeocode_normalizar_chave($bairro);
    $mapaBairros = ecogeocode_bairros_juazeiro();
    if (isset($mapaBairros[$bairroChave])) {
        $coords = $mapaBairros[$bairroChave];
        return [
            "lat" => (string) $coords["lat"],
            "lon" => (string) $coords["lng"],
            "display_name" => "Bairro {$bairro}, {$cidadeLabel}",
            "precision" => "bairro",
        ];
    }

    $offset = ecogeocode_offset_bairro(
        $bairro,
        (float) $centroCidade["lat"],
        (float) $centroCidade["lng"]
    );
    return [
        "lat" => (string) $offset["lat"],
        "lon" => (string) $offset["lng"],
        "display_name" => "Área aproximada — {$bairro}, {$cidadeLabel}",
        "precision" => "aproximado",
    ];
}

function ecogeocode_resolver_endereco(string $rua, string $bairro, string $cidade): ?array
{
    $rua = trim($rua);
    $bairro = trim($bairro);
    $cidade = trim($cidade);

    if (
        ($bairro === "" || $bairro === "—" || $bairro === "-")
        && strpos($rua, ",") !== false
    ) {
        $partes = array_map("trim", explode(",", $rua));
        $partes = array_values(array_filter($partes, static fn ($p) => $p !== ""));
        if (count($partes) >= 2) {
            $bairro = (string) array_pop($partes);
            $rua = implode(", ", $partes);
        }
    }

    if ($cidade === "" || $cidade === "—" || $cidade === "-") {
        $cidade = "Juazeiro do Norte";
    }

    $cidadeChave = ecogeocode_normalizar_chave($cidade);
    $cidadeChave = preg_replace("/\s*-\s*ce$/", "", $cidadeChave) ?? $cidadeChave;
    $cidadeChave = trim($cidadeChave);

    $centros = ecogeocode_centros_cidade();
    $centroCidade = $centros[$cidadeChave] ?? $centros["juazeiro do norte"];
    $cidadeLabel = $centroCidade["label"];
    $cidadeRef = preg_replace("/,?\s*Brasil$/i", "", $cidadeLabel) ?? $cidadeLabel;
    $fallbackLocal = ecogeocode_fallback_bairro($bairro, $centroCidade, $cidadeLabel);
    if ($fallbackLocal !== null && ($fallbackLocal["precision"] ?? "") === "bairro") {
        return $fallbackLocal;
    }

    $consultas = [];
    $ruas = ecogeocode_variacoes_rua($rua);
    foreach (array_slice($ruas, 0, 2) as $nomeRua) {
        if ($bairro !== "" && $bairro !== "—" && $bairro !== "-") {
            $consultas[] = "{$nomeRua}, {$bairro}, {$cidadeRef}, Brasil";
        }
        $consultas[] = "{$nomeRua}, {$cidadeRef}, Brasil";
    }
    if ($bairro !== "" && $bairro !== "—" && $bairro !== "-") {
        $consultas[] = "{$bairro}, {$cidadeRef}, Brasil";
    }
    if ($rua !== "" && $rua !== "—" && $rua !== "-") {
        $partes = array_map("trim", explode(",", $rua));
        $partes = array_values(array_filter($partes, static fn ($p) => $p !== ""));
        if (count($partes) >= 2) {
            $consultas[] = "Rua {$partes[0]}, {$partes[1]}, {$cidadeRef}, Brasil";
        }
    }

    $vistos = [];
    $tentativas = 0;
    foreach ($consultas as $consulta) {
        $consulta = trim($consulta);
        if ($consulta === "" || isset($vistos[$consulta])) {
            continue;
        }
        $vistos[$consulta] = true;
        if ($tentativas >= 1) {
            break;
        }
        $tentativas++;
        $hit = ecogeocode_buscar_externo($consulta);
        if ($hit !== null) {
            return $hit;
        }
    }

    if ($fallbackLocal !== null) {
        return $fallbackLocal;
    }

    return [
        "lat" => (string) $centroCidade["lat"],
        "lon" => (string) $centroCidade["lng"],
        "display_name" => $cidadeLabel,
        "precision" => "cidade",
    ];
}
