<?php
declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(403);
    exit("CLI only\n");
}

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/ecopontos-repository.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";

ecopontos_garantir_schema($conn);
$sync = ecopontos_sincronizar_catalogo($conn, false);
$idPev = ecoseed_pev_padrao_id($conn);
$realinhar = ecoseed_realinhar_ecoponto_padrao($conn);
$resumo = ecoadm_resumo_coletas_hoje($conn, $idPev);

fwrite(STDOUT, "Sync: " . json_encode($sync, JSON_UNESCAPED_UNICODE) . "\n");
fwrite(STDOUT, "PEV padrao id: {$idPev}\n");
fwrite(STDOUT, "Resumo hoje: " . json_encode($resumo, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
