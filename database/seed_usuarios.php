<?php

declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(403);
    exit("Execute apenas via linha de comando: php database/seed_usuarios.php\n");
}

$root = dirname(__DIR__);
require_once $root . "/includes/conexao.php";
require_once $root . "/includes/usuarios-seed-sync.php";
require_once $root . "/includes/admin-ecoponto-data.php";
require_once $root . "/includes/coletas-ecoponto-seed.php";

function ecoseed_log(string $msg): void
{
    fwrite(STDOUT, $msg . PHP_EOL);
}

function ecoseed_erro(string $msg): void
{
    fwrite(STDERR, "[ERRO] " . $msg . PHP_EOL);
    exit(1);
}

$fresh = in_array("--fresh", $argv ?? [], true) || in_array("-f", $argv ?? [], true);

ecoseed_log("=== EcoColeta — seed de usuários fictícios ===");
ecoseed_log("");

if ($fresh) {
    ecoseed_log("Modo --fresh: removendo usuários seed existentes...");
    $removidos = ecoseed_remover_usuarios_seed($conn);
    ecoseed_log("Removidos: {$removidos}");
} else {
    $existentes = ecoseed_contar_usuarios_seed($conn);
    if ($existentes >= ECOSEED_COUNT) {
        ecoseed_log("Já existem {$existentes} usuários seed (esperado: " . ECOSEED_COUNT . ").");
        ecoseed_log($existentes > ECOSEED_COUNT
            ? "Use --fresh para recriar exatamente " . ECOSEED_COUNT . " usuários."
            : "Nada a fazer. Use --fresh para repopular.");
        exit(0);
    }
    if ($existentes > 0) {
        ecoseed_log("Existem {$existentes} usuários seed; completando até " . ECOSEED_COUNT . "...");
    }
}

$stats = ecoseed_usuarios_sincronizar($conn, $fresh);
if ($stats["total"] <= 0 && $stats["inseridos"] <= 0) {
    ecoseed_erro("Nenhum usuário seed inserido. Verifique tabelas bairro/rua.");
}

ecoseed_log("");
ecoseed_log("Inseridos nesta execução: " . (int) $stats["inseridos"]);
ecoseed_log("Total de usuários seed no banco: " . (int) $stats["total"]);
ecoseed_log("Senha padrão (login): " . ECOSEED_DEFAULT_PASSWORD);
ecoseed_log("Domínio dos e-mails seed: " . ECOSEED_EMAIL_SUFFIX);
ecoseed_log("");
ecoseed_log("Concluído.");

if (function_exists("ecocoletas_sincronizar_seed") && ecoadm_tabela_agendamento_operacional($conn)) {
    ecoseed_log("");
    ecoseed_log("Sincronizando coletas EcoPonto para moradores seed…");
    $coletas = ecocoletas_sincronizar_seed($conn, true);
    ecoseed_log("Coletas seed no banco: " . (int) ($coletas["total"] ?? 0));
}

exit(0);
