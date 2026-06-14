<?php

declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(403);
    exit("Execute via CLI: php database/seed_tudo.php\n");
}

$root = dirname(__DIR__);
$argvLocal = $argv ?? [];
$fresh = in_array("--fresh", $argvLocal, true) || in_array("-f", $argvLocal, true);
$freshArg = $fresh ? " --fresh" : "";

function ecoseed_tudo_run(string $label, string $script, bool $fresh): int
{
    global $root, $argvLocal;

    fwrite(STDOUT, PHP_EOL . "=== {$label} ===" . PHP_EOL);

    $php = PHP_BINARY;
    $cmd = escapeshellarg($php) . " " . escapeshellarg($root . "/database/" . $script);
    if ($fresh) {
        $cmd .= " --fresh";
    }

    passthru($cmd, $exitCode);
    if ($exitCode !== 0) {
        fwrite(STDERR, "[ERRO] Falha em {$script} (código {$exitCode})." . PHP_EOL);
    }
    return (int) $exitCode;
}

fwrite(STDOUT, "EcoColeta — seed completo do banco" . PHP_EOL);
if ($fresh) {
    fwrite(STDOUT, "Modo --fresh: recria todos os dados seed." . PHP_EOL);
}

$steps = [
    ["Usuários (50 moradores)", "seed_usuarios.php"],
    ["Ecopontos", "seed_ecopontos.php"],
    ["Coletas EcoPonto (50)", "seed_coletas_ecoponto.php"],
    ["Agendamentos plataforma", "seed_agendamentos.php"],
    ["Entregas, resgates, notificações, prêmios", "seed_complementar.php"],
    ["Relatórios (coleta mensal / evolução)", "seed_relatorio.php"],
];

$erro = 0;
foreach ($steps as [$label, $script]) {
    $erro |= ecoseed_tudo_run($label, $script, $fresh);
}

fwrite(STDOUT, PHP_EOL);
if ($erro !== 0) {
    fwrite(STDERR, "Concluído com erros. Verifique as mensagens acima." . PHP_EOL);
    exit(1);
}

fwrite(STDOUT, "Seed completo concluído. Todas as telas ADM leem do MySQL." . PHP_EOL);
exit(0);
