<?php

declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(403);
    exit("Execute via CLI.\n");
}

$root = dirname(__DIR__);
require_once $root . "/includes/conexao.php";
require_once $root . "/includes/agendamentos-plataforma-seed.php";

$fresh = in_array("--fresh", $argv ?? [], true) || in_array("-f", $argv ?? [], true);

fwrite(STDOUT, "=== EcoColeta — seed agendamentos (plataforma) ===\n\n");

if (!ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
    fwrite(STDERR, "[ERRO] Tabela agendamento_coleta_morador inexistente. Rode INSTALAR-BANCO.bat.\n");
    exit(1);
}

if ($fresh) {
    fwrite(STDOUT, "Modo --fresh: removendo agendamentos/usuários seed…\n");
    ecoagend_remover_seed($conn);
}

$stats = ecoagend_sincronizar_seed($conn, !$fresh);

fwrite(STDOUT, "Agendamentos inseridos/atualizados: {$stats['inseridos']}\n");
fwrite(STDOUT, "Perfis criados para agendamento: {$stats['usuarios_criados']}\n");
fwrite(STDOUT, "Total no banco: {$stats['total']}\n");
fwrite(STDOUT, "\nConcluído.\n");

exit(0);
