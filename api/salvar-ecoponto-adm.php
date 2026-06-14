<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-helpers.php";
require_once dirname(__DIR__) . "/includes/ecopontos-repository.php";

ecoplat_exigir_sessao();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    ecoplat_json_erro("Método não permitido.", 405);
}

$raw = file_get_contents("php://input");
$input = [];
if (is_string($raw) && trim($raw) !== "" && ($raw[0] === "{" || $raw[0] === "[")) {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $input = $decoded;
    }
}
if ($input === []) {
    $input = $_POST;
}

try {
    $ecoponto = ecopontos_salvar($conn, $input);
    ecoplat_json_ok([
        "ecoponto" => $ecoponto,
        "resumo" => ecopontos_calcular_resumo(ecopontos_listar_do_banco($conn)),
    ]);
} catch (InvalidArgumentException $e) {
    ecoplat_json_erro($e->getMessage());
} catch (Throwable $e) {
    ecoplat_json_erro("Não foi possível salvar o ecoponto.");
}
