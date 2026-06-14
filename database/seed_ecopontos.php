<?php

declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(403);
    exit("Execute via CLI.\n");
}

$root = dirname(__DIR__);
require_once $root . "/includes/conexao.php";
require_once $root . "/includes/ecopontos-repository.php";

$fresh = in_array("--fresh", $argv ?? [], true) || in_array("-f", $argv ?? [], true);

fwrite(STDOUT, "=== EcoColeta — seed ecopontos (catálogo → banco) ===\n\n");

if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
    fwrite(STDERR, "[ERRO] Tabela ponto_entrega não existe. Rode INSTALAR-BANCO.bat.\n");
    exit(1);
}

ecopontos_garantir_schema($conn);

if ($fresh) {
    $catalog = ecopontos_carregar_catalogo();
    $ids = [];
    foreach ($catalog as $item) {
        if (!is_array($item)) {
            continue;
        }
        $cid = trim((string) ($item["id"] ?? ""));
        if ($cid !== "") {
            $ids[] = $cid;
        }
    }
    if ($ids !== []) {
        $placeholders = implode(", ", array_fill(0, count($ids), "?"));
        $types = str_repeat("s", count($ids));
        $stmt = $conn->prepare(
            "DELETE FROM ponto_entrega WHERE catalog_id IN ({$placeholders})"
        );
        if ($stmt) {
            $stmt->bind_param($types, ...$ids);
            $stmt->execute();
            fwrite(STDOUT, "Removidos (fresh): " . $stmt->affected_rows . "\n");
            $stmt->close();
        }
    }
}

$stats = ecopontos_garantir_todos_ativos($conn);
$lista = ecopontos_listar_do_banco($conn);
$catalogo = count(ecopontos_carregar_catalogo());

fwrite(STDOUT, "Catálogo do mapa: {$catalogo}\n");
fwrite(STDOUT, "Inseridos: {$stats['inseridos']}\n");
fwrite(STDOUT, "Atualizados: {$stats['atualizados']}\n");
fwrite(STDOUT, "Ativados agora: {$stats['ativados']}\n");
fwrite(STDOUT, "Total no banco: {$stats['total_banco']} (ativos: {$stats['ativos']})\n");
fwrite(STDOUT, "\nConcluído.\n");

exit(0);
