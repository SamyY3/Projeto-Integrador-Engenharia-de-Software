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
$ctx = ecoadm_obter_contexto($conn, $idAdmin);
$idPev = (int) ($ctx["id_pev"] ?? 0);
$nomeEco = (string) ($ctx["pev"]["nome_ponto"] ?? $ctx["admin"]["nome_ecoponto"] ?? "");

$metodo = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));

if ($metodo === "GET") {
    ecoadm_json_ok([
        "administradores" => ecoadm_listar_administradores_pev(
            $conn,
            $idPev,
            $nomeEco,
            $idAdmin
        ),
    ]);
}

$body = $_POST;
if (empty($body) && ($raw = file_get_contents("php://input"))) {
    $json = json_decode($raw, true);
    if (is_array($json)) {
        $body = $json;
    }
}

if ($metodo === "POST") {
    $resultado = ecoadm_salvar_administrador_pev($conn, $idAdmin, $idPev, $nomeEco, $body);
    ecoadm_json_ok([
        "mensagem" => $resultado["mensagem"] ?? "Salvo.",
        "administradores" => ecoadm_listar_administradores_pev(
            $conn,
            $idPev,
            $nomeEco,
            $idAdmin
        ),
    ]);
}

if ($metodo === "DELETE") {
    $idExcluir = (int) ($body["id_admin"] ?? $_GET["id_admin"] ?? 0);
    ecoadm_excluir_administrador_pev($conn, $idAdmin, $idPev, $nomeEco, $idExcluir);
    ecoadm_json_ok([
        "mensagem" => "Administrador removido.",
        "administradores" => ecoadm_listar_administradores_pev(
            $conn,
            $idPev,
            $nomeEco,
            $idAdmin
        ),
    ]);
}

ecoadm_json_erro("Metodo nao permitido.", 405);
