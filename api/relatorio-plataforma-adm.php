<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-data.php";
require_once dirname(__DIR__) . "/includes/relatorio-plataforma.php";
require_once dirname(__DIR__) . "/includes/relatorio-plataforma-seed.php";

ecoplat_exigir_sessao();
ecoplat_garantir_schema_sessao($conn);

$sync = isset($_GET["sync"]) && $_GET["sync"] === "1";
if ($sync) {
    ecoplat_relatorio_garantir_dados($conn, true);
} else {
    $ano = (int) date("Y");
    $mesesSeed = ecoplat_relatorio_contar_meses_seed_ano($conn, $ano);
    if ($mesesSeed < ECOPLAT_REL_MIN_MESES_ANO) {
        ecoplat_relatorio_garantir_dados($conn, false);
    }
}

$desde = trim((string) ($_GET["desde"] ?? ""));
$ate = trim((string) ($_GET["ate"] ?? ""));
$bairro = trim((string) ($_GET["bairro"] ?? ""));

$relatorio = ecoplat_relatorio_montar($conn, $desde !== "" ? $desde : null, $ate !== "" ? $ate : null, $bairro);

ecoplat_json_ok([
    "relatorio" => $relatorio,
    "meta" => $relatorio["meta"] ?? ["fonte" => "banco"],
]);
