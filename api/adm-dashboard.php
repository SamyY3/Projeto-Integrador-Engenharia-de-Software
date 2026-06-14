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

$ctx = ecoadm_obter_contexto($conn, $idAdmin);

$dashboard = ecoadm_montar_dashboard($conn, $idAdmin, $ctx);

ecoadm_json_ok([
    "dashboard" => $dashboard,
    "admin" => [
        "id" => $idAdmin,
        "nome" => (string) ($ctx["admin"]["nome"] ?? ""),
        "email" => (string) ($ctx["admin"]["email"] ?? ""),
        "ecoponto" => (string) ($ctx["pev"]["nome_ponto"] ?? ""),
        "endereco" => (string) ($ctx["pev"]["endereco"] ?? ""),
        "id_pev" => (int) ($ctx["id_pev"] ?? 0),
        "latitude" => isset($ctx["pev"]["latitude"]) && $ctx["pev"]["latitude"] !== null
            ? (float) $ctx["pev"]["latitude"] : null,
        "longitude" => isset($ctx["pev"]["longitude"]) && $ctx["pev"]["longitude"] !== null
            ? (float) $ctx["pev"]["longitude"] : null,
        "cidade" => (string) ($ctx["pev"]["cidade"] ?? ""),
    ],
]);
