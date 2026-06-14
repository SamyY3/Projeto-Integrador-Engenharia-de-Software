<?php

declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(403);
    exit("Execute via CLI.\n");
}

$root = dirname(__DIR__);
require_once $root . "/includes/conexao.php";
require_once $root . "/includes/admin-ecoponto-data.php";
require_once $root . "/includes/ecopontos-repository.php";
require_once $root . "/includes/agendamentos-plataforma-seed.php";
require_once $root . "/includes/seed-dados-completos.php";

$fresh = in_array("--fresh", $argv ?? [], true) || in_array("-f", $argv ?? [], true);

fwrite(STDOUT, "=== EcoColeta — seed dashboard (legado → complementar) ===\n\n");

ecopontos_garantir_schema($conn);
ecoadm_garantir_schema_integracao($conn);

if ($fresh) {
    ecoseed_complementar_limpar($conn);
}

$ag = ecoagend_sincronizar_seed($conn, !$fresh);
$stats = ecoseed_complementar_sincronizar($conn, $fresh);

fwrite(STDOUT, "Agendamentos (seed): total {$ag['total']}, novos {$ag['inseridos']}\n");
fwrite(STDOUT, "Entregas inseridas: " . (int) ($stats["entregas"]["inseridos"] ?? 0) . "\n");
fwrite(STDOUT, "Itens de entrega: " . (int) ($stats["entregas"]["itens"] ?? 0) . "\n");
fwrite(STDOUT, "Resgates seed: " . (int) ($stats["resgates"]["total"] ?? 0) . "\n");
fwrite(STDOUT, "Total entregas moradores seed: " . (int) ($stats["entregas_total"] ?? 0) . "\n");
fwrite(STDOUT, "\nConcluído.\n");

exit(0);
