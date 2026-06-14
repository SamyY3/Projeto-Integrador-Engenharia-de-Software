<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-helpers.php";
require_once dirname(__DIR__) . "/includes/stmt_helpers.php";

$idAdmin = ecoplat_exigir_sessao();

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "POST")) !== "POST") {
    ecoplat_json_erro("Método não permitido.", 405);
}

$body = $_POST;
$raw = file_get_contents("php://input");
if (is_string($raw) && $raw !== "") {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $body = $decoded;
    }
}

$senhaAtual = (string) ($body["senha_atual"] ?? "");
$senhaNova = (string) ($body["senha_nova"] ?? "");
$senhaConfirmar = (string) ($body["senha_confirmar"] ?? "");

if ($senhaAtual === "" || $senhaNova === "" || $senhaConfirmar === "") {
    ecoplat_json_erro("Preencha todos os campos de senha.");
}

if ($senhaNova !== $senhaConfirmar) {
    ecoplat_json_erro("A nova senha e a confirmação não coincidem.");
}

if (strlen($senhaNova) < 8) {
    ecoplat_json_erro("A nova senha deve ter pelo menos 8 caracteres.");
}

if (!preg_match("/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/", $senhaNova)) {
    ecoplat_json_erro("A nova senha deve conter letra maiúscula, minúscula e número.");
}

if ($senhaAtual === $senhaNova) {
    ecoplat_json_erro("A nova senha deve ser diferente da senha atual.");
}

$stmt = $conn->prepare(
    "SELECT senha_hash FROM administrador_plataforma WHERE id_admin = ? LIMIT 1"
);
if (!$stmt) {
    ecoplat_json_erro("Não foi possível validar a senha atual.");
}

$stmt->bind_param("i", $idAdmin);
$stmt->execute();
$row = ecocoleta_stmt_fetch_one_assoc($stmt);
$stmt->close();

if (!$row || !password_verify($senhaAtual, (string) ($row["senha_hash"] ?? ""))) {
    ecoplat_json_erro("Senha atual incorreta.");
}

$hash = password_hash($senhaNova, PASSWORD_DEFAULT);
if ($hash === false) {
    ecoplat_json_erro("Não foi possível processar a nova senha.");
}

$upd = $conn->prepare(
    "UPDATE administrador_plataforma SET senha_hash = ? WHERE id_admin = ? LIMIT 1"
);
if (!$upd) {
    ecoplat_json_erro("Não foi possível atualizar a senha.");
}

$upd->bind_param("si", $hash, $idAdmin);
if (!$upd->execute()) {
    $upd->close();
    ecoplat_json_erro("Não foi possível salvar a nova senha.");
}
$upd->close();

ecoplat_json_ok(["mensagem" => "Senha alterada com sucesso."]);
