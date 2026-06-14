<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-data.php";

$idAdmin = ecoplat_exigir_sessao();
$metodo = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));

if ($metodo === "GET") {
    ecoplat_json_ok([
        "administradores" => ecoplat_listar_administradores_plataforma($conn, $idAdmin),
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
    $resultado = ecoplat_salvar_administrador_plataforma($conn, $idAdmin, $body);
    ecoplat_json_ok([
        "mensagem" => $resultado["mensagem"] ?? "Salvo.",
        "administradores" => ecoplat_listar_administradores_plataforma($conn, $idAdmin),
    ]);
}

if ($metodo === "DELETE") {
    $idExcluir = (int) ($body["id_admin"] ?? $_GET["id_admin"] ?? 0);
    ecoplat_excluir_administrador_plataforma($conn, $idAdmin, $idExcluir);
    ecoplat_json_ok([
        "mensagem" => "Administrador removido.",
        "administradores" => ecoplat_listar_administradores_plataforma($conn, $idAdmin),
    ]);
}

ecoplat_json_erro("Metodo nao permitido.", 405);
