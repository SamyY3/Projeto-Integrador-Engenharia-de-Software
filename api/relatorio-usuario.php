<?php
require_once dirname(__DIR__) . "/includes/session-bootstrap.php";

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/relatorio-usuario.php";

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "GET") {
    http_response_code(405);
    echo json_encode(["sucesso" => false, "erro" => "Método não permitido."], JSON_UNESCAPED_UNICODE);
    exit;
}

$periodo = trim((string) ($_GET["periodo"] ?? "mensal"));
if (!in_array($periodo, ["mensal", "semanal", "semana", "trimestral"], true)) {
    $periodo = "mensal";
}

$idUsuario = 0;
if (!empty($_SESSION["usuario_id"])) {
    $idUsuario = (int) $_SESSION["usuario_id"];
}

$relatorio = ecorep_montar_relatorio($conn, $idUsuario, $periodo);

echo json_encode([
    "sucesso" => true,
    "autenticado" => $idUsuario > 0,
    "id_usuario" => $idUsuario > 0 ? $idUsuario : null,
    "relatorio" => $relatorio,
], JSON_UNESCAPED_UNICODE);
