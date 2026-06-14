<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";

$idAdmin = ecoadm_exigir_sessao();
ecoadm_garantir_colunas_admin($conn);
$ctxPerfil = ecoadm_obter_contexto($conn, $idAdmin);

$cols = "id_admin, nome, email, nome_ecoponto, status";
if (ecoadm_admin_tem_coluna($conn, "telefone")) {
    $cols .= ", telefone";
}
if (ecoadm_admin_tem_coluna($conn, "foto_perfil")) {
    $cols .= ", foto_perfil";
}
if (ecoadm_admin_tem_coluna($conn, "preferencias_json")) {
    $cols .= ", preferencias_json";
}

$sql = "SELECT {$cols} FROM administrador_ecoponto WHERE id_admin = ? LIMIT 1";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    ecoadm_json_erro("Erro ao preparar consulta do perfil administrativo.");
}

$stmt->bind_param("i", $idAdmin);
if (!$stmt->execute()) {
    $stmt->close();
    ecoadm_json_erro("Erro ao carregar perfil administrativo.");
}

$row = ecocoleta_stmt_fetch_one_assoc($stmt);
$stmt->close();

if (!$row) {
    ecoadm_json_erro("Administrador nao encontrado.");
}

ecoadm_sync_sessao_admin($row);

$preferencias = ecoadm_preferencias_padrao();
if (
    ecoadm_admin_tem_coluna($conn, "preferencias_json")
    && !empty($row["preferencias_json"])
) {
    $decoded = json_decode((string) $row["preferencias_json"], true);
    $preferencias = ecoadm_normalizar_preferencias($decoded);
}

$telefone = ecoadm_garantir_telefone_admin($conn, $idAdmin);
$emailAtual = (string) $row["email"];
$emailAltPendente = trim((string) ($_SESSION["ecoponto_admin_email_alt_novo"] ?? ""));
$emailAltVerificado = ecoadm_email_alteracao_verificada($emailAltPendente);

$admin = [
    "id" => (int) $row["id_admin"],
    "nome" => (string) $row["nome"],
    "email" => $emailAtual,
    "email_mascarado" => ecoadm_mascarar_email($emailAtual),
    "telefone" => $telefone,
    "telefone_mascarado" => ecoadm_mascarar_telefone($telefone),
    "ecoponto" => (string) ($ctxPerfil["pev"]["nome_ponto"] ?? $row["nome_ecoponto"]),
    "endereco" => (string) ($ctxPerfil["pev"]["endereco"] ?? ""),
    "id_pev" => (int) ($ctxPerfil["id_pev"] ?? 0),
    "status" => (string) $row["status"],
    "preferencias" => $preferencias,
    "email_alteracao_pendente" => $emailAltPendente,
    "email_alteracao_verificado" => $emailAltVerificado,
];

if (
    ecoadm_admin_tem_coluna($conn, "foto_perfil")
    && !empty($row["foto_perfil"])
) {
    $admin["foto_perfil"] = (string) $row["foto_perfil"];
}

ecoadm_json_ok([
    "admin" => $admin,
    "mensagem" => "Perfil administrativo carregado.",
]);
