<?php

session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/stmt_helpers.php";

if (empty($_SESSION["usuario_id"]) || (int) $_SESSION["usuario_id"] <= 0) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Sessao expirada. Faca login novamente.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$uid = (int) $_SESSION["usuario_id"];
$saldo = ecocoleta_obter_saldo_usuario($conn, $uid);

echo json_encode([
    "sucesso" => true,
    "saldo_ecopoints" => $saldo,
], JSON_UNESCAPED_UNICODE);
