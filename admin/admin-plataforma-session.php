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

$acao = trim((string) ($_POST["acao"] ?? $_GET["acao"] ?? "status"));

if ($acao === "logout") {
    ecoplat_encerrar_sessao();
    ecoplat_json_ok(["mensagem" => "Sessao da plataforma encerrada."]);
}

if (empty($_SESSION["ecocoleta_plat_admin_id"]) || (int) $_SESSION["ecocoleta_plat_admin_id"] <= 0) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Sessao da plataforma expirada. Faca login novamente.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

ecoplat_garantir_schema_sessao($conn);
ecoplat_json_ok(["admin" => ecoplat_payload_sessao()]);
