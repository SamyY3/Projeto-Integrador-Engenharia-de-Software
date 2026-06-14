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

$exigirSessao = true;
if (isset($_GET["publico"]) && $_GET["publico"] === "1") {
    $exigirSessao = false;
}
if ($exigirSessao) {
    ecoplat_exigir_sessao();
}

$catalog = ecopontos_carregar_catalogo();
$totalCatalogo = count($catalog);
$forcarSync = isset($_GET["sync"]) && $_GET["sync"] === "1";

if ($forcarSync && $totalCatalogo > 0 && ecocoleta_tabela_existe($conn, "ponto_entrega")) {
    ecopontos_sincronizar_catalogo($conn, false);
}

if ($totalCatalogo > 0 && ecocoleta_tabela_existe($conn, "ponto_entrega")) {
    $comCoordenadas = ecopontos_listar_do_banco($conn);
    $comCoords = 0;
    foreach ($comCoordenadas as $item) {
        if (isset($item["lat"], $item["lng"]) && $item["lat"] !== null && $item["lng"] !== null) {
            $comCoords++;
        }
    }
    if ($comCoords < max(3, (int) floor($totalCatalogo * 0.5))) {
        ecopontos_sincronizar_catalogo($conn, false);
    }
}

$lista = ecopontos_listar_do_banco($conn);

ecoplat_json_ok([
    "ecopontos" => $lista,
    "resumo" => ecopontos_calcular_resumo($lista),
    "meta" => [
        "total_catalogo_mapa" => $totalCatalogo,
        "fonte" => "banco",
        "total" => count($lista),
        "vazio" => $lista === [],
    ],
]);
