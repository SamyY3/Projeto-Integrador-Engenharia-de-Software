<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

require_once dirname(__DIR__) . "/ecocheck/ecocheck-lib.php";

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

ecocheck_limpar_verificacao_sessao();

$_SESSION = [];

if (ini_get("session.use_cookies")) {
    $p = session_get_cookie_params();
    setcookie(session_name(), "", time() - 42000, $p["path"], $p["domain"], $p["secure"], $p["httponly"]);
}

session_destroy();

echo json_encode([
    "sucesso" => true,
    "mensagem" => "Sessao encerrada.",
], JSON_UNESCAPED_UNICODE);
