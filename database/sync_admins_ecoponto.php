<?php
declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(403);
    exit("CLI only\n");
}

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";

ecoadm_garantir_colunas_entrega_materiais($conn);
$criados = ecoadm_garantir_admins_ecoponto_equipe($conn);
$idPev = ecoadm_resolver_pev_catalogo($conn, ecoadm_pev_padrao_nome());
$distribuidos = $idPev > 0 ? ecoadm_distribuir_responsaveis_entregas_pev($conn, $idPev) : 0;
fwrite(STDOUT, "Administradores criados agora: {$criados}\n");
fwrite(STDOUT, "Entregas com responsavel atribuido: {$distribuidos}\n\n");

$res = @$conn->query(
    "SELECT nome, email, funcao, nome_ecoponto
     FROM administrador_ecoponto
     WHERE status = 'ativo'
     ORDER BY nome ASC"
);
if ($res) {
    while ($row = $res->fetch_assoc()) {
        fwrite(
            STDOUT,
            ($row["nome"] ?? "") . " | " .
            ($row["email"] ?? "") . " | " .
            ($row["funcao"] ?? "—") . " | " .
            ($row["nome_ecoponto"] ?? "") . "\n"
        );
    }
    $res->free();
}

fwrite(STDOUT, "\nResponsaveis sugeridos:\n");
foreach (ecoadm_listar_responsaveis_sugeridos($conn, ecoadm_resolver_pev_catalogo($conn, ecoadm_pev_padrao_nome())) as $r) {
    fwrite(STDOUT, " - {$r}\n");
}

exit(0);
