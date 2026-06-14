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
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";
require_once dirname(__DIR__) . "/includes/dashboard-plataforma.php";

ecoplat_exigir_sessao();
ecoplat_garantir_schema_sessao($conn);

$sync = isset($_GET["sync"]) && $_GET["sync"] === "1";
$dashboard = ecoplat_dashboard_payload($conn, $sync);

ecoplat_json_ok([
    "dashboard" => $dashboard,
    "meta" => $dashboard["meta"] ?? ["fonte" => "banco"],
]);
