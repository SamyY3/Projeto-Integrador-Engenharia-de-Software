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
require_once dirname(__DIR__) . "/includes/admin-ecoponto-helpers.php";

$idAdmin = ecoplat_exigir_sessao();
$perfil = ecoplat_obter_perfil_admin($conn, $idAdmin);

if (!$perfil) {
    ecoplat_json_erro("Administrador nao encontrado.");
}

ecoplat_sync_sessao_admin($perfil);

$emailAtual = (string) ($perfil["email"] ?? "");
$emailAltPendente = trim((string) ($_SESSION["ecoplat_admin_email_alt_novo"] ?? ""));

$admin = array_merge($perfil, [
    "id" => (int) ($perfil["id_admin"] ?? 0),
    "email_mascarado" => ecoadm_mascarar_email($emailAtual),
    "email_alteracao_pendente" => $emailAltPendente,
    "email_alteracao_verificado" => ecoplat_email_alteracao_verificada($emailAltPendente),
]);

ecoplat_json_ok([
    "admin" => $admin,
    "mensagem" => "Perfil carregado.",
]);
