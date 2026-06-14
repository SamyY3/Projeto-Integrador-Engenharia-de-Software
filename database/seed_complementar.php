<?php

declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(403);
    exit("Execute via CLI: php database/seed_complementar.php\n");
}

$root = dirname(__DIR__);
require_once $root . "/includes/conexao.php";
require_once $root . "/includes/seed-dados-completos.php";

$fresh = in_array("--fresh", $argv ?? [], true) || in_array("-f", $argv ?? [], true);

fwrite(STDOUT, "=== EcoColeta — seed complementar (dados completos) ===\n\n");

if ($fresh) {
    fwrite(STDOUT, "Modo --fresh: removendo entregas, resgates e notificações seed…\n");
    ecoseed_complementar_limpar($conn);
}

$stats = ecoseed_complementar_sincronizar($conn, $fresh);

fwrite(STDOUT, "Materiais criados: " . (int) ($stats["materiais_novos"] ?? 0) . "\n");
fwrite(STDOUT, "Prêmios sincronizados: " . (int) ($stats["premios_sync"] ?? 0) . "\n");
fwrite(STDOUT, "Configuração plataforma: " . (($stats["config_ok"] ?? false) ? "ok" : "já existia") . "\n");
fwrite(STDOUT, "Admins criados — plataforma: " . (int) ($stats["admins"]["plataforma"] ?? 0)
    . ", ecoponto: " . (int) ($stats["admins"]["ecoponto"] ?? 0) . "\n");
fwrite(STDOUT, "Entregas inseridas: " . (int) ($stats["entregas"]["inseridos"] ?? 0)
    . " | itens: " . (int) ($stats["entregas"]["itens"] ?? 0) . "\n");
fwrite(STDOUT, "Total entregas moradores seed: " . (int) ($stats["entregas_total"] ?? 0) . "\n");
fwrite(STDOUT, "Resgates inseridos: " . (int) ($stats["resgates"]["inseridos"] ?? 0)
    . " | total seed: " . (int) ($stats["resgates"]["total"] ?? 0) . "\n");
fwrite(STDOUT, "Notificações — moradores: " . (int) ($stats["notificacoes"]["moradores"] ?? 0)
    . " | admin: " . (int) ($stats["notificacoes"]["admins"] ?? 0) . "\n");
if (!empty($stats["realinhado"])) {
    $r = $stats["realinhado"];
    fwrite(STDOUT, "Realinhado EcoPonto Juazeiro Centro (id_pev "
        . (int) ($stats["id_pev_padrao"] ?? 0) . "): entregas "
        . (int) ($r["entregas"] ?? 0) . ", coletas caminhão "
        . (int) ($r["coletas_caminhao"] ?? 0) . ", coletas prefeitura "
        . (int) ($r["coletas_prefeitura"] ?? 0) . "\n");
}
fwrite(STDOUT, "\nConcluído.\n");

exit(0);
