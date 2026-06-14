<?php

declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(403);
    exit("Execute via CLI: php database/seed_coletas_ecoponto.php\n");
}

$root = dirname(__DIR__);
require_once $root . "/includes/conexao.php";
require_once $root . "/includes/coletas-ecoponto-seed.php";

$fresh = in_array("--fresh", $argv ?? [], true) || in_array("-f", $argv ?? [], true);

fwrite(STDOUT, "=== EcoColeta — seed coletas EcoPonto ===\n\n");

if (!ecoadm_tabela_agendamento_operacional($conn)) {
    fwrite(STDERR, "[ERRO] Tabela agendamento_coleta_morador inexistente. Rode INSTALAR-BANCO.bat.\n");
    exit(1);
}

$seedUsuarios = 0;
$like = "%" . ECOCOLETAS_SEED_EMAIL_SUFFIX;
$stmt = $conn->prepare("SELECT COUNT(*) AS c FROM usuario WHERE email LIKE ?");
if ($stmt) {
    $stmt->bind_param("s", $like);
    $stmt->execute();
    $c = 0;
    $stmt->bind_result($c);
    $stmt->fetch();
    $stmt->close();
    $seedUsuarios = (int) $c;
}

if ($seedUsuarios < ECOCOLETAS_SEED_TOTAL) {
    fwrite(STDERR, "[AVISO] Apenas {$seedUsuarios} moradores seed no banco. Rode seed_usuarios.php antes.\n");
}

if ($fresh) {
    $removidos = ecocoletas_seed_remover($conn);
    fwrite(STDOUT, "Modo --fresh: removidas {$removidos} coletas seed.\n");
}

$stats = ecocoletas_sincronizar_seed($conn, !$fresh);

fwrite(STDOUT, "Coletas inseridas/atualizadas: {$stats['inseridos']}\n");
fwrite(STDOUT, "EcoPonto (id_pev): {$stats['id_pev']}\n");
fwrite(STDOUT, "Total de coletas seed: {$stats['total']}\n");
fwrite(STDOUT, "\nConcluído.\n");

exit(0);
