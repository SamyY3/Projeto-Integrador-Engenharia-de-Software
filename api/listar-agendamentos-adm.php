<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-data.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";
require_once dirname(__DIR__) . "/includes/agendamentos-plataforma-seed.php";
require_once dirname(__DIR__) . "/includes/agendamentos-plataforma-adm-format.php";

ecoplat_exigir_sessao();
ecoplat_garantir_schema_sessao($conn);

ecoadm_garantir_schema_integracao($conn);
ecoagend_garantir_enum_cancelado($conn);

if (isset($_GET["sync"]) && $_GET["sync"] === "1") {
    ecoagend_sincronizar_seed($conn, false);
} else {
    ecoagend_vincular_pev_existentes($conn);
}

$lista = [];
$rows = ecoadm_listar_coletas($conn, 0, []);
foreach ($rows as $row) {
    if (trim((string) ($row["nome_ecoponto"] ?? "")) === "") {
        $nomeResolvido = ecoadm_resolver_nome_ecoponto_agendamento($conn, $row);
        if ($nomeResolvido !== "") {
            $row["nome_ecoponto"] = $nomeResolvido;
        }
    }
    $lista[] = ecoplat_formatar_agendamento_item($row);
}

ecoplat_json_ok([
    "agendamentos" => $lista,
    "resumo" => ecoplat_resumo_agendamentos($lista),
    "meta" => [
        "fonte" => "banco",
        "total_banco" => count($lista),
    ],
]);
