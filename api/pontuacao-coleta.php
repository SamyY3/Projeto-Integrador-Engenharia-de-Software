<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/pontuacao-coleta.php";

$metodo = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));
$input = $metodo === "POST" ? $_POST : $_GET;

$peso = round((float) ($input["peso_kg"] ?? $input["peso"] ?? 0), 2);
$tiposRaw = trim((string) ($input["tipo_residuo"] ?? $input["materiais"] ?? ""));
$tipos = $tiposRaw !== "" ? coleta_tipos_residuo_de_storage($tiposRaw) : [];

if ($peso < 0.1) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Informe um peso valido para simular.",
        "simulacao" => true,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$calc = coleta_calcular_pontos($peso, $tipos, true);
$nivel = coleta_calcular_nivel((int) $calc["total"]);

echo json_encode([
    "sucesso" => true,
    "simulacao" => true,
    "mensagem" => "Estimativa apenas — nenhum ponto foi salvo.",
    "peso_kg" => $peso,
    "pontos_estimados" => (int) $calc["total"],
    "detalhe" => $calc["detalhe"],
    "nivel_estimado" => $nivel,
], JSON_UNESCAPED_UNICODE);
