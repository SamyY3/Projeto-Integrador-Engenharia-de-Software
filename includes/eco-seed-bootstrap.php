<?php

declare(strict_types=1);

const ECOSEED_BOOTSTRAP_VERSAO = 1;

function ecoseed_bootstrap_auto_ativo(): bool
{
    $env = getenv("ECO_SEED_AUTO");
    if ($env !== false && trim((string) $env) !== "") {
        return !in_array(strtolower(trim((string) $env)), ["0", "false", "no", "off"], true);
    }
    return true;
}

function ecoseed_bootstrap_contar_tabela(mysqli $conn, string $tabela): int
{
    if (!ecocoleta_tabela_existe($conn, $tabela)) {
        return 0;
    }
    $tabela = preg_replace('/[^A-Za-z0-9_]/', "", $tabela);
    $res = @$conn->query("SELECT COUNT(*) AS c FROM `{$tabela}`");
    if (!$res) {
        return 0;
    }
    $row = $res->fetch_assoc();
    $res->free();
    return (int) ($row["c"] ?? 0);
}

function ecoseed_bootstrap_precisa(mysqli $conn): bool
{
    if (!ecocoleta_tabela_existe($conn, "usuario")) {
        return false;
    }

    require_once __DIR__ . "/usuarios-seed-data.php";
    require_once __DIR__ . "/usuarios-seed-sync.php";

    if (ecoseed_contar_usuarios_seed($conn) < ECOSEED_USUARIOS_TOTAL) {
        return true;
    }

    if (ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        $catalogo = 0;
        if (is_file(__DIR__ . "/ecopontos-catalog-data.php")) {
            require_once __DIR__ . "/ecopontos-repository.php";
            $catalogo = count(ecopontos_carregar_catalogo());
        }
        if ($catalogo > 0 && ecoseed_bootstrap_contar_tabela($conn, "ponto_entrega") < min(5, $catalogo)) {
            return true;
        }
    }

    if (
        ecocoleta_tabela_existe($conn, "administrador_ecoponto")
        && ecoseed_bootstrap_contar_tabela($conn, "administrador_ecoponto") < 1
    ) {
        return true;
    }

    if (ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
        require_once __DIR__ . "/admin-ecoponto-data.php";
        if (ecoadm_tabela_agendamento_operacional($conn)) {
            require_once __DIR__ . "/coletas-ecoponto-seed.php";
            if (ecocoletas_seed_contar($conn) < ECOCOLETAS_SEED_TOTAL) {
                return true;
            }
        }
    }

    if (ecocoleta_tabela_existe($conn, "beneficio") && ecoseed_bootstrap_contar_tabela($conn, "beneficio") < 3) {
        return true;
    }

    return false;
}

function ecoseed_bootstrap_executar(mysqli $conn, bool $forcar = false): array
{
    @set_time_limit(300);

    $resultado = [
        "versao" => ECOSEED_BOOTSTRAP_VERSAO,
        "etapas" => [],
        "ok" => true,
    ];

    require_once __DIR__ . "/usuarios-seed-sync.php";
    require_once __DIR__ . "/ecopontos-repository.php";
    require_once __DIR__ . "/admin-ecoponto-data.php";
    require_once __DIR__ . "/coletas-ecoponto-seed.php";
    require_once __DIR__ . "/agendamentos-plataforma-seed.php";
    require_once __DIR__ . "/seed-dados-completos.php";
    require_once __DIR__ . "/relatorio-plataforma-seed.php";

    ecoadm_garantir_schema_integracao($conn);

    $usuarios = ecoseed_usuarios_sincronizar($conn, $forcar);
    $resultado["etapas"]["usuarios"] = $usuarios;

    if (ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        ecopontos_garantir_schema($conn);
        $resultado["etapas"]["ecopontos"] = ecopontos_garantir_todos_ativos($conn);
    }

    if (ecoadm_tabela_agendamento_operacional($conn)) {
        if ($forcar) {
            ecocoletas_seed_remover($conn);
        }
        $resultado["etapas"]["coletas_ecoponto"] = ecocoletas_sincronizar_seed($conn, !$forcar);
        $resultado["etapas"]["agendamentos"] = ecoagend_sincronizar_seed($conn, !$forcar);
    }

    $resultado["etapas"]["complementar"] = ecoseed_complementar_sincronizar($conn, $forcar);
    $resultado["etapas"]["relatorio"] = ecoplat_relatorio_garantir_dados($conn, $forcar);

    return $resultado;
}

function ecoseed_bootstrap_if_needed(mysqli $conn): void
{
    static $executado = false;
    if ($executado || !ecoseed_bootstrap_auto_ativo()) {
        return;
    }
    $executado = true;

    if (!ecoseed_bootstrap_precisa($conn)) {
        return;
    }

    $lock = @$conn->query("SELECT GET_LOCK('ecocoleta_seed_bootstrap', 2) AS l");
    $temLock = false;
    if ($lock) {
        $row = $lock->fetch_assoc();
        $lock->free();
        $temLock = (int) ($row["l"] ?? 0) === 1;
    }
    if (!$temLock) {
        return;
    }

    try {
        ecoseed_bootstrap_executar($conn, false);
    } finally {
        @$conn->query("SELECT RELEASE_LOCK('ecocoleta_seed_bootstrap')");
    }
}
