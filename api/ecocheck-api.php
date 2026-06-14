<?php
ini_set("display_errors", "0");
error_reporting(0);

require_once dirname(__DIR__) . "/ecocheck/ecocheck-lib.php";

ecocheck_iniciar_sessao();

$acao = trim((string) ($_GET["action"] ?? $_POST["action"] ?? ""));

if ($acao === "challenge") {
    ecocheck_json(ecocheck_criar_desafio());
}

if ($acao === "verify") {
    $raw = file_get_contents("php://input");
    $json = [];
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $json = $decoded;
        }
    }
    $payload = array_merge($_POST, $json);
    ecocheck_json(ecocheck_verificar_desafio($payload));
}

if ($acao === "status") {
    $valido = ecocheck_token_valido_na_requisicao();
    ecocheck_json([
        "sucesso" => true,
        "verified" => $valido,
        "expiresIn" => $valido ? max(0, (int) ($_SESSION["ecocheck_verified_exp"] ?? 0) - time()) : 0,
    ]);
}

ecocheck_json(["sucesso" => false, "erro" => "Acao invalida."], 400);
