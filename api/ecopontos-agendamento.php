<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/ecoponto-agendamento.php";

if (empty($_SESSION["usuario_id"]) || (int) $_SESSION["usuario_id"] <= 0) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Sessao expirada. Faca login novamente.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "GET") {
    http_response_code(405);
    echo json_encode(["sucesso" => false, "erro" => "Metodo nao permitido."], JSON_UNESCAPED_UNICODE);
    exit;
}

$idUsuario = (int) $_SESSION["usuario_id"];
$tipoResiduo = trim((string) ($_GET["tipo_residuo"] ?? ""));

echo json_encode([
    "sucesso" => true,
    "agendamento" => ecoponto_payload_agendamento($conn, $idUsuario, $tipoResiduo),
], JSON_UNESCAPED_UNICODE);
