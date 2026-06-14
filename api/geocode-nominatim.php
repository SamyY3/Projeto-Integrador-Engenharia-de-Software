<?php

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/geocode-resolver.php";

$q = isset($_GET["q"]) ? trim((string) $_GET["q"]) : "";
$rua = isset($_GET["rua"]) ? trim((string) $_GET["rua"]) : "";
$bairro = isset($_GET["bairro"]) ? trim((string) $_GET["bairro"]) : "";
$cidade = isset($_GET["cidade"]) ? trim((string) $_GET["cidade"]) : "";

if ($rua !== "" || $bairro !== "" || $cidade !== "") {
    if ($rua === "" && $q !== "") {
        $rua = $q;
    }
    $hit = ecogeocode_resolver_endereco($rua, $bairro, $cidade);
    echo json_encode($hit !== null ? [$hit] : []);
    exit;
}

if ($q === "" || strlen($q) < 3 || strlen($q) > 240) {
    echo json_encode([]);
    exit;
}

$hits = ecogeocode_nominatim($q);
if ($hits === []) {
    $hits = ecogeocode_photon($q);
}

echo json_encode($hits);
