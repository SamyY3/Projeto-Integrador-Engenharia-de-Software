<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-data.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-helpers.php";

$idAdmin = ecoplat_exigir_sessao();
ecoplat_garantir_colunas_admin($conn);

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "POST")) !== "POST") {
    ecoplat_json_erro("Metodo nao permitido.", 405);
}

$stmtAtual = $conn->prepare("SELECT email FROM administrador_plataforma WHERE id_admin = ? LIMIT 1");
$emailAtualDb = "";
if ($stmtAtual) {
    $stmtAtual->bind_param("i", $idAdmin);
    if ($stmtAtual->execute()) {
        $rowAtual = ecocoleta_stmt_fetch_one_assoc($stmtAtual);
        $emailAtualDb = trim((string) ($rowAtual["email"] ?? ""));
    }
    $stmtAtual->close();
}

[$email, $senha] = ecoplat_validar_email_senha_perfil();
ecoplat_exigir_verificacao_troca_email($conn, $idAdmin, $emailAtualDb, $email);

$nome = mb_substr(trim((string) ($_POST["nome"] ?? "")), 0, 120, "UTF-8");
$cargo = mb_substr(trim((string) ($_POST["cargo"] ?? "")), 0, 120, "UTF-8");

if ($nome === "") {
    ecoplat_json_erro("Informe o nome do administrador.");
}

$tentouFoto = ecoadm_cliente_enviou_foto();
$fotoPath = null;
if (!ecoplat_admin_tem_coluna($conn, "foto_perfil")) {
    if ($tentouFoto) {
        ecoplat_json_erro("Coluna foto_perfil ausente no banco. Contate o suporte.");
    }
} else {
    $fotoPath = ecoadm_processar_foto_upload($idAdmin);
    if ($tentouFoto && $fotoPath === null) {
        ecoplat_json_erro("Nao foi possivel gravar a foto. Verifique a pasta uploads/ do projeto.");
    }
}

$resultado = ecoplat_atualizar_perfil_admin($conn, $idAdmin, [
    "nome" => $nome,
    "email" => $email,
    "cargo" => $cargo,
    "senha" => $senha,
], $fotoPath);

if (strcasecmp($emailAtualDb, $email) !== 0) {
    ecoplat_limpar_verificacao_email_sessao();
}

if ($fotoPath !== null) {
    $resultado["foto_perfil"] = $fotoPath;
    if (isset($resultado["admin"]) && is_array($resultado["admin"])) {
        $resultado["admin"]["foto_perfil"] = $fotoPath;
    }
}

ecoplat_json_ok($resultado);
