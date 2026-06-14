<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-data.php";
require_once dirname(__DIR__) . "/includes/configuracoes-plataforma.php";

$idAdmin = ecoplat_exigir_sessao();
ecoplat_garantir_schema_sessao($conn);

$metodo = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));

if ($metodo === "GET") {
    $config = ecoplat_config_carregar($conn);
    $payload = ecoplat_config_resposta_publica($config, $conn);
    ecoplat_json_ok(array_merge($payload, [
        "administradores" => ecoplat_listar_administradores_plataforma($conn, $idAdmin),
        "mensagem" => "Configurações carregadas.",
    ]));
}

if ($metodo !== "POST") {
    ecoplat_json_erro("Método não permitido.", 405);
}

$configAtual = ecoplat_config_carregar($conn);
$body = $_POST;
$raw = file_get_contents("php://input");
if (is_string($raw) && $raw !== "") {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $body = $decoded;
    }
}

$merge = $configAtual;

if (isset($body["geral"]) && is_array($body["geral"])) {
    $merge["geral"] = array_merge($merge["geral"], $body["geral"]);
}
if (isset($body["notificacoes"]) && is_array($body["notificacoes"])) {
    foreach ($body["notificacoes"] as $k => $v) {
        $merge["notificacoes"][$k] = ecoplat_config_bool($v);
    }
}
if (isset($body["integracoes"]) && is_array($body["integracoes"])) {
    $integ = $body["integracoes"];
    if (array_key_exists("recaptcha_ativo", $integ)) {
        $merge["integracoes"]["recaptcha_ativo"] = ecoplat_config_bool($integ["recaptcha_ativo"]);
    }
    if (isset($integ["recaptcha_site_key"])) {
        $merge["integracoes"]["recaptcha_site_key"] = trim((string) $integ["recaptcha_site_key"]);
    }
    if (isset($integ["recaptcha_secret_key"]) && trim((string) $integ["recaptcha_secret_key"]) !== "") {
        $merge["integracoes"]["recaptcha_secret_key"] = trim((string) $integ["recaptcha_secret_key"]);
    }
    if (!empty($integ["regenerar_api_key"])) {
        $merge["integracoes"]["api_key"] = ecoplat_config_gerar_api_key();
    }
}
if (isset($body["seguranca"]) && is_array($body["seguranca"])) {
    if (array_key_exists("dois_fatores", $body["seguranca"])) {
        $merge["seguranca"]["dois_fatores"] = ecoplat_config_bool($body["seguranca"]["dois_fatores"]);
    }
    if (isset($body["seguranca"]["sessoes"]) && is_array($body["seguranca"]["sessoes"])) {
        $merge["seguranca"]["sessoes"] = $body["seguranca"]["sessoes"];
    }
}
if (isset($body["permissoes"]) && is_array($body["permissoes"])) {
    foreach ($body["permissoes"] as $role => $perms) {
        if (!is_string($role) || !is_array($perms) || !isset($merge["permissoes"][$role])) {
            continue;
        }
        foreach ($perms as $chave => $valor) {
            if (array_key_exists($chave, $merge["permissoes"][$role])) {
                $merge["permissoes"][$role][$chave] = ecoplat_config_bool($valor);
            }
        }
    }
    $merge["permissoes"] = ecoplat_config_normalizar_permissoes($merge["permissoes"]);
}

$email = trim((string) ($merge["geral"]["email_contato"] ?? ""));
if ($email !== "" && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    ecoplat_json_erro("Informe um e-mail de contato válido.");
}

$nomeSite = trim((string) ($merge["geral"]["nome_site"] ?? ""));
if ($nomeSite === "") {
    ecoplat_json_erro("Informe o nome do site.");
}

if (!ecoplat_config_salvar($conn, $merge)) {
    ecoplat_json_erro("Não foi possível salvar as configurações.");
}

$payload = ecoplat_config_resposta_publica($merge, $conn);
ecoplat_json_ok(array_merge($payload, ["mensagem" => "Configurações salvas com sucesso."]));
