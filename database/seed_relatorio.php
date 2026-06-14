<?php

declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(403);
    exit("Execute via CLI: php database/seed_relatorio.php\n");
}

$root = dirname(__DIR__);
require_once $root . "/includes/conexao.php";
require_once $root . "/includes/relatorio-plataforma-seed.php";

$fresh = in_array("--fresh", $argv ?? [], true) || in_array("-f", $argv ?? [], true);

fwrite(STDOUT, "=== EcoColeta — seed Relatórios (coleta mensal + evolução) ===\n\n");

if ($fresh) {
    fwrite(STDOUT, "Modo --fresh: recriando entregas seed de relatório…\n");
}

$stats = ecoplat_relatorio_garantir_dados($conn, $fresh);
$rel = $stats["relatorio"] ?? [];
$ano = (int) ($rel["ano"] ?? date("Y"));
$meses = ecoplat_relatorio_contar_meses_seed_ano($conn, $ano);

fwrite(STDOUT, "Ano: {$ano}\n");
fwrite(STDOUT, "Entregas inseridas: " . (int) ($rel["inseridos"] ?? 0) . "\n");
fwrite(STDOUT, "Itens de material: " . (int) ($rel["itens"] ?? 0) . "\n");
fwrite(STDOUT, "Meses com dados seed: {$meses}\n");
fwrite(STDOUT, "\nAbra: http://localhost/Ecocoleta/admin/relatorio-adm.html\n");
fwrite(STDOUT, "Concluído.\n");

exit(0);
