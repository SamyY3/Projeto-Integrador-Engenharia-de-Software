<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/stmt_helpers.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";
require_once dirname(__DIR__) . "/ecocheck/ecocheck-lib.php";

$acao = trim((string) ($_POST["acao"] ?? $_GET["acao"] ?? "status"));

if ($acao === "logout") {
    ecocheck_limpar_verificacao_sessao();
    unset(
        $_SESSION["ecoponto_admin_id"],
        $_SESSION["ecoponto_admin_nome"],
        $_SESSION["ecoponto_admin_email"],
        $_SESSION["ecoponto_admin_nome_ecoponto"],
        $_SESSION["ecoponto_admin_foto"],
        $_SESSION["ecoponto_admin_id_pev"],
        $_SESSION["ecoadm_schema_ok"]
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

$idAdmin = (int) $_SESSION["ecoponto_admin_id"];
ecoadm_garantir_schema_sessao($conn);

$ctx = ecoadm_obter_contexto($conn, $idAdmin);
$pev = $ctx["pev"];
$_SESSION["ecoponto_admin_id_pev"] = (int) ($ctx["id_pev"] ?? 0);
$_SESSION["ecoponto_admin_nome_ecoponto"] = (string) (
    $pev["nome_ponto"] ?? ecoadm_pev_padrao_nome()
);

$nomeSessao = (string) ($_SESSION["ecoponto_admin_nome"] ?? "Administrador");
$adminPayload = [
    "id" => $idAdmin,
    "nome" => $nomeSessao,
    "email" => (string) ($_SESSION["ecoponto_admin_email"] ?? ""),
    "ecoponto" => (string) ($pev["nome_ponto"] ?? ecoadm_pev_padrao_nome()),
    "endereco" => (string) ($pev["endereco"] ?? ""),
    "id_pev" => (int) ($pev["id_pev"] ?? 0),
    "latitude" => isset($pev["latitude"]) && $pev["latitude"] !== null ? (float) $pev["latitude"] : null,
    "longitude" => isset($pev["longitude"]) && $pev["longitude"] !== null ? (float) $pev["longitude"] : null,
    "cidade" => (string) ($pev["cidade"] ?? ""),
];

if (!empty($_SESSION["ecoponto_admin_foto"])) {
    $adminPayload["foto_perfil"] = (string) $_SESSION["ecoponto_admin_foto"];
}

echo json_encode([
    "sucesso" => true,
    "admin" => $adminPayload,
], JSON_UNESCAPED_UNICODE);
