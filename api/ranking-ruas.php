<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/ranking-ruas.php";

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "GET") {
    http_response_code(405);
    echo json_encode(["sucesso" => false, "erro" => "Método não permitido."], JSON_UNESCAPED_UNICODE);
    exit;
}

$periodo = trim((string) ($_GET["periodo"] ?? "semana"));
if (!in_array($periodo, ["semana", "mes"], true)) {
    $periodo = "semana";
}

$idUsuario = (int) ($_GET["id_usuario"] ?? 0);
if ($idUsuario <= 0 && !empty($_SESSION["usuario_id"])) {
    $idUsuario = (int) $_SESSION["usuario_id"];
}

$payload = ecorank_montar_payload($conn, $periodo, $idUsuario);

echo json_encode([
    "sucesso" => true,
    "autenticado" => $idUsuario > 0,
    "id_usuario" => $idUsuario > 0 ? $idUsuario : null,
    "ranking" => $payload,
], JSON_UNESCAPED_UNICODE);
