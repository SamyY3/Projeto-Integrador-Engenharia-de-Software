<?php
require_once __DIR__ . '/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

$acao = trim((string) ($_POST["acao"] ?? $_GET["acao"] ?? "status"));

if ($acao === "logout") {
    unset(
        $_SESSION["ecoponto_admin_id"],
        $_SESSION["ecoponto_admin_nome"],
        $_SESSION["ecoponto_admin_email"],
        $_SESSION["ecoponto_admin_nome_ecoponto"],
        $_SESSION["ecoponto_admin_foto"]
    );

    echo json_encode([
        "sucesso" => true,
        "mensagem" => "Sessao administrativa encerrada.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($_SESSION["ecoponto_admin_id"]) || (int) $_SESSION["ecoponto_admin_id"] <= 0) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Sessao administrativa expirada. Faca login novamente.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$adminPayload = [
    "id" => (int) $_SESSION["ecoponto_admin_id"],
    "nome" => (string) ($_SESSION["ecoponto_admin_nome"] ?? "Administrador"),
    "email" => (string) ($_SESSION["ecoponto_admin_email"] ?? ""),
    "ecoponto" => (string) ($_SESSION["ecoponto_admin_nome_ecoponto"] ?? "EcoPonto parceiro"),
];

if (!empty($_SESSION["ecoponto_admin_foto"])) {
    $adminPayload["foto_perfil"] = (string) $_SESSION["ecoponto_admin_foto"];
}

echo json_encode([
    "sucesso" => true,
    "admin" => $adminPayload,
], JSON_UNESCAPED_UNICODE);
