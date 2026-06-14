<?php
ini_set("display_errors", "0");
error_reporting(0);

header("Content-Type: application/json; charset=utf-8");

include dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/senha-validacao.php";

$token = trim((string) ($_POST["token"] ?? ""));
$novaSenha = (string) ($_POST["senha"] ?? "");

if ($token === "" || $novaSenha === "") {
    echo json_encode(["sucesso" => false, "erro" => "Preencha todos os campos"]);
    exit;
}

$sql = "SELECT id_usuario, reset_token_expira FROM usuario WHERE reset_token = ? LIMIT 1";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"]);
    exit;
}

$stmt->bind_param("s", $token);
if (!$stmt->execute()) {
    echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"]);
    exit;
}

$row = ecocoleta_stmt_fetch_one_assoc($stmt);
$stmt->close();
if (!$row) {
    echo json_encode(["sucesso" => false, "erro" => "Sessao expirada"]);
    exit;
}

$expiraTs = strtotime($row["reset_token_expira"]);
if ($expiraTs === false || $expiraTs < time()) {
    echo json_encode(["sucesso" => false, "erro" => "Sessao expirada"]);
    exit;
}

if (strlen($novaSenha) < 8 || strlen($novaSenha) > 16) {
    echo json_encode(["sucesso" => false, "erro" => "A senha deve ter entre 8 e 16 caracteres"]);
    exit;
}

if (ecocoleta_senha_tem_numeros_sequenciais($novaSenha)) {
    echo json_encode(["sucesso" => false, "erro" => "A senha não pode conter números sequenciais (ex.: 1234)"]);
    exit;
}

$senhaHash = password_hash($novaSenha, PASSWORD_DEFAULT);
$sqlUp = "UPDATE usuario SET senha_hash = ?, reset_token = NULL, reset_token_expira = NULL, codigo_recuperacao_hash = NULL, codigo_recuperacao_expira = NULL WHERE id_usuario = ?";
$stmtUp = $conn->prepare($sqlUp);
if (!$stmtUp) {
    echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"]);
    exit;
}

$uid = (int) $row["id_usuario"];
$stmtUp->bind_param("si", $senhaHash, $uid);

if ($stmtUp->execute()) {
    echo json_encode(["sucesso" => true, "mensagem" => "Senha alterada"]);
} else {
    echo json_encode(["sucesso" => false, "erro" => "Erro ao atualizar senha"]);
}
