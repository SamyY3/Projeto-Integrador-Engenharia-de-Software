<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";

$idAdmin = ecoadm_exigir_sessao();

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "GET") {
    ecoadm_json_erro("Metodo nao permitido.", 405);
}

$periodo = trim((string) ($_GET["periodo"] ?? "mes"));
$materialFiltro = trim((string) ($_GET["material"] ?? ""));

$payload = ecoadm_montar_relatorio($conn, $idAdmin, $periodo, $materialFiltro);

ecoadm_json_ok($payload);
