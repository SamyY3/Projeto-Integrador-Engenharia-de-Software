<?php

declare(strict_types=1);

require_once __DIR__ . "/stmt_helpers.php";

function ecoplat_config_padrao(): array
{
    return [
        "geral" => [
            "nome_site" => "EcoColeta",
            "email_contato" => "contato@ecocoleta.local",
            "tema" => "dark",
        ],
        "notificacoes" => [
            "coletas_agendadas" => true,
            "ecopontos_problemas" => true,
            "relatorios_semanais" => true,
            "atualizacoes_sistema" => false,
        ],
        "integracoes" => [
            "api_key" => "",
            "recaptcha_ativo" => true,
            "recaptcha_site_key" => "",
            "recaptcha_secret_key" => "",
        ],
        "seguranca" => [
            "dois_fatores" => false,
            "sessoes" => [],
        ],
        "permissoes" => ecoplat_config_permissoes_padrao(),
    ];
}

function ecoplat_config_permissoes_padrao(): array
{
    return [
        "admin" => [
            "criar_usuarios" => true,
            "editar_usuarios" => true,
            "excluir_usuarios" => true,
            "gerenciar_ecopontos" => true,
            "visualizar_ecopontos" => true,
            "visualizar_relatorios" => true,
            "configuracoes_sistema" => true,
        ],
        "gerente" => [
            "criar_usuarios" => true,
            "editar_usuarios" => true,
            "excluir_usuarios" => false,
            "gerenciar_ecopontos" => true,
            "visualizar_ecopontos" => true,
            "visualizar_relatorios" => true,
            "configuracoes_sistema" => false,
        ],
        "visualizador" => [
            "criar_usuarios" => false,
            "editar_usuarios" => false,
            "excluir_usuarios" => false,
            "gerenciar_ecopontos" => false,
            "visualizar_ecopontos" => true,
            "visualizar_relatorios" => true,
            "configuracoes_sistema" => false,
        ],
    ];
}

function ecoplat_config_permissoes_chaves(): array
{
    return [
        "criar_usuarios",
        "editar_usuarios",
        "excluir_usuarios",
        "gerenciar_ecopontos",
        "visualizar_ecopontos",
        "visualizar_relatorios",
        "configuracoes_sistema",
    ];
}

function ecoplat_config_normalizar_permissoes($perms): array
{
    $padrao = ecoplat_config_permissoes_padrao();
    if (!is_array($perms)) {
        return $padrao;
    }

    $out = [];
    foreach ($padrao as $role => $defaults) {
        $src = is_array($perms[$role] ?? null) ? $perms[$role] : [];
        $out[$role] = [];
        foreach ($defaults as $chave => $valPadrao) {
            $out[$role][$chave] = array_key_exists($chave, $src)
                ? ecoplat_config_bool($src[$chave])
                : $valPadrao;
        }
    }

    return $out;
}

function ecoplat_config_sessoes_padrao(): array
{
    return [
        [
            "id" => "sess-chrome-win",
            "tipo" => "desktop",
            "rotulo" => "Chrome (Windows)",
            "ultima_atividade" => "16:30",
        ],
        [
            "id" => "sess-firefox-android",
            "tipo" => "mobile",
            "rotulo" => "Firefox (Android)",
            "ultima_atividade" => "14:12",
        ],
        [
            "id" => "sess-edge-mac",
            "tipo" => "desktop",
            "rotulo" => "Edge (macOS)",
            "ultima_atividade" => "11:05",
        ],
        [
            "id" => "sess-safari-ipad",
            "tipo" => "mobile",
            "rotulo" => "Safari (iPad)",
            "ultima_atividade" => "09:48",
        ],
        [
            "id" => "sess-opera-iphone",
            "tipo" => "mobile",
            "rotulo" => "Opera (iPhone)",
            "ultima_atividade" => "08:20",
        ],
    ];
}

function ecoplat_config_normalizar_sessoes($lista): array
{
    $base = ecoplat_config_sessoes_padrao();
    if (!is_array($lista) || $lista === []) {
        return ecoplat_config_marcar_sessao_atual($base);
    }

    $out = [];
    foreach ($lista as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = trim((string) ($item["id"] ?? ""));
        if ($id === "") {
            continue;
        }
        $tipo = strtolower((string) ($item["tipo"] ?? "desktop"));
        if (!in_array($tipo, ["desktop", "mobile"], true)) {
            $tipo = "desktop";
        }
        $out[] = [
            "id" => $id,
            "tipo" => $tipo,
            "rotulo" => trim((string) ($item["rotulo"] ?? "Dispositivo")),
            "ultima_atividade" => trim((string) ($item["ultima_atividade"] ?? "—")),
            "atual" => ecoplat_config_bool($item["atual"] ?? false),
        ];
    }

    if ($out === []) {
        return ecoplat_config_marcar_sessao_atual($base);
    }

    $temAtual = false;
    foreach ($out as $s) {
        if (!empty($s["atual"])) {
            $temAtual = true;
            break;
        }
    }
    if (!$temAtual && isset($out[0])) {
        $out[0]["atual"] = true;
    }

    return $out;
}

function ecoplat_config_marcar_sessao_atual(array $sessoes): array
{
    $ua = strtolower((string) ($_SERVER["HTTP_USER_AGENT"] ?? ""));
    $atualId = "sess-chrome-win";
    if (str_contains($ua, "android") || str_contains($ua, "iphone") || str_contains($ua, "mobile")) {
        $atualId = "sess-firefox-android";
    } elseif (str_contains($ua, "firefox")) {
        $atualId = "sess-firefox-android";
    } elseif (str_contains($ua, "edg")) {
        $atualId = "sess-edge-mac";
    } elseif (str_contains($ua, "safari")) {
        $atualId = str_contains($ua, "mobile") ? "sess-opera-iphone" : "sess-safari-ipad";
    }

    $hora = date("H:i");
    $found = false;
    foreach ($sessoes as $i => $s) {
        $sessoes[$i]["atual"] = ($s["id"] ?? "") === $atualId;
        if ($sessoes[$i]["atual"]) {
            $sessoes[$i]["ultima_atividade"] = $hora;
            $found = true;
        }
    }
    if (!$found && isset($sessoes[0])) {
        $sessoes[0]["atual"] = true;
        $sessoes[0]["ultima_atividade"] = $hora;
        $sessoes[0]["rotulo"] = ecoplat_config_rotulo_sessao_atual();
    }

    return $sessoes;
}

function ecoplat_config_rotulo_sessao_atual(): string
{
    $ua = (string) ($_SERVER["HTTP_USER_AGENT"] ?? "");
    $nav = "Navegador";
    if (stripos($ua, "Chrome") !== false && stripos($ua, "Edg") === false) {
        $nav = "Chrome";
    } elseif (stripos($ua, "Firefox") !== false) {
        $nav = "Firefox";
    } elseif (stripos($ua, "Edg") !== false) {
        $nav = "Edge";
    } elseif (stripos($ua, "Safari") !== false) {
        $nav = "Safari";
    } elseif (stripos($ua, "Opera") !== false || stripos($ua, "OPR") !== false) {
        $nav = "Opera";
    }

    $os = "Desktop";
    if (stripos($ua, "Windows") !== false) {
        $os = "Windows";
    } elseif (stripos($ua, "Android") !== false) {
        $os = "Android";
    } elseif (stripos($ua, "iPhone") !== false) {
        $os = "iPhone";
    } elseif (stripos($ua, "iPad") !== false) {
        $os = "iPad";
    } elseif (stripos($ua, "Mac") !== false) {
        $os = "macOS";
    }

    return $nav . " (" . $os . ")";
}

function ecoplat_config_garantir_tabela(mysqli $conn): void
{
    if (ecocoleta_tabela_existe($conn, "configuracao_plataforma")) {
        return;
    }

    @$conn->query(
        "CREATE TABLE IF NOT EXISTS configuracao_plataforma (
            chave VARCHAR(64) NOT NULL PRIMARY KEY,
            valor_json LONGTEXT NOT NULL,
            atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function ecoplat_config_normalizar($data): array
{
    $padrao = ecoplat_config_padrao();
    if (!is_array($data)) {
        return $padrao;
    }

    $geral = is_array($data["geral"] ?? null) ? $data["geral"] : $data;
    $notif = is_array($data["notificacoes"] ?? null) ? $data["notificacoes"] : [];
    $integ = is_array($data["integracoes"] ?? null) ? $data["integracoes"] : [];
    $seg = is_array($data["seguranca"] ?? null) ? $data["seguranca"] : [];
    $perms = is_array($data["permissoes"] ?? null) ? $data["permissoes"] : [];

    $tema = strtolower(trim((string) ($geral["tema"] ?? $padrao["geral"]["tema"])));
    if (!in_array($tema, ["light", "dark"], true)) {
        $tema = "light";
    }

    return [
        "geral" => [
            "nome_site" => trim((string) ($geral["nome_site"] ?? $padrao["geral"]["nome_site"])),
            "email_contato" => trim((string) ($geral["email_contato"] ?? $padrao["geral"]["email_contato"])),
            "tema" => $tema,
        ],
        "notificacoes" => [
            "coletas_agendadas" => ecoplat_config_bool($notif["coletas_agendadas"] ?? true),
            "ecopontos_problemas" => ecoplat_config_bool($notif["ecopontos_problemas"] ?? true),
            "relatorios_semanais" => ecoplat_config_bool($notif["relatorios_semanais"] ?? true),
            "atualizacoes_sistema" => ecoplat_config_bool($notif["atualizacoes_sistema"] ?? false),
        ],
        "integracoes" => [
            "api_key" => trim((string) ($integ["api_key"] ?? "")),
            "recaptcha_ativo" => ecoplat_config_bool($integ["recaptcha_ativo"] ?? true),
            "recaptcha_site_key" => trim((string) ($integ["recaptcha_site_key"] ?? "")),
            "recaptcha_secret_key" => trim((string) ($integ["recaptcha_secret_key"] ?? "")),
        ],
        "seguranca" => [
            "dois_fatores" => ecoplat_config_bool($seg["dois_fatores"] ?? false),
            "sessoes" => ecoplat_config_normalizar_sessoes($seg["sessoes"] ?? []),
        ],
        "permissoes" => ecoplat_config_normalizar_permissoes($perms),
    ];
}

function ecoplat_config_bool($v): bool
{
    if (is_bool($v)) {
        return $v;
    }
    if (is_string($v)) {
        return in_array(strtolower($v), ["1", "true", "sim", "yes", "on"], true);
    }
    return (bool) $v;
}

function ecoplat_config_gerar_api_key(): string
{
    return "eco_" . bin2hex(random_bytes(16));
}

function ecoplat_config_carregar(mysqli $conn): array
{
    ecoplat_config_garantir_tabela($conn);

    $config = ecoplat_config_padrao();
    $stmt = $conn->prepare(
        "SELECT valor_json FROM configuracao_plataforma WHERE chave = 'plataforma' LIMIT 1"
    );
    if ($stmt) {
        $stmt->execute();
        $row = ecocoleta_stmt_fetch_one_assoc($stmt);
        $stmt->close();
        if ($row && !empty($row["valor_json"])) {
            $decoded = json_decode((string) $row["valor_json"], true);
            $config = ecoplat_config_normalizar($decoded);
        }
    }

    if ($config["integracoes"]["api_key"] === "") {
        $config["integracoes"]["api_key"] = ecoplat_config_gerar_api_key();
        ecoplat_config_salvar($conn, $config);
    }

    return $config;
}

function ecoplat_config_salvar(mysqli $conn, array $config): bool
{
    ecoplat_config_garantir_tabela($conn);

    $config = ecoplat_config_normalizar($config);
    $json = json_encode($config, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return false;
    }

    $chave = "plataforma";
    $stmt = $conn->prepare(
        "INSERT INTO configuracao_plataforma (chave, valor_json)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)"
    );
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param("ss", $chave, $json);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}

function ecoplat_config_listar_funcoes(mysqli $conn): array
{
    $admins = 0;
    $gerentes = 0;
    $visualizadores = 0;

    if (ecocoleta_tabela_existe($conn, "usuario")) {
        $res = @$conn->query(
            "SELECT tipo_usuario, COUNT(*) AS c FROM usuario GROUP BY tipo_usuario"
        );
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $tipo = strtolower((string) ($row["tipo_usuario"] ?? ""));
                $c = (int) ($row["c"] ?? 0);
                if ($tipo === "admin") {
                    $admins += $c;
                } elseif ($tipo === "cooperativa") {
                    $gerentes += $c;
                } else {
                    $visualizadores += $c;
                }
            }
            $res->free();
        }
    }

    $tblPlat = @$conn->query("SHOW TABLES LIKE 'administrador_plataforma'");
    if ($tblPlat && $tblPlat->num_rows > 0) {
        $tblPlat->free();
        $resPlat = @$conn->query("SELECT COUNT(*) AS c FROM administrador_plataforma");
        if ($resPlat) {
            $row = $resPlat->fetch_assoc();
            $admins += (int) ($row["c"] ?? 0);
            $resPlat->free();
        }
    } elseif ($tblPlat) {
        $tblPlat->free();
    }

    return [
        [
            "id" => "admin",
            "titulo" => "Administrador",
            "descricao" => "Acesso completo ao sistema",
            "total" => $admins,
        ],
        [
            "id" => "gerente",
            "titulo" => "Gerente",
            "descricao" => "Gerencia coletas e ecopontos",
            "total" => $gerentes,
        ],
        [
            "id" => "visualizador",
            "titulo" => "Visualizador",
            "descricao" => "Consulta relatórios e indicadores",
            "total" => $visualizadores,
        ],
    ];
}

function ecoplat_config_resposta_publica(array $config, mysqli $conn): array
{
    $funcoes = ecoplat_config_listar_funcoes($conn);

    return [
        "config" => $config,
        "funcoes" => $funcoes,
    ];
}
