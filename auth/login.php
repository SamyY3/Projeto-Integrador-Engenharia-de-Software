<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/ecocheck/ecocheck-lib.php";

ecocheck_iniciar_sessao();
ecocheck_exigir_token();

$email = trim((string) ($_POST["email"] ?? ""));
$senha = (string) ($_POST["senha"] ?? "");

if ($email === "" || $senha === "") {
    echo json_encode(["sucesso" => false, "erro" => "Preencha todos os campos"], JSON_UNESCAPED_UNICODE);
    exit;
}

$normalizedEmail = mb_strtolower($email, 'UTF-8');
$sql = "SELECT id_usuario, nome, email, senha_hash FROM usuario WHERE LOWER(email) = ? LIMIT 1";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode(["sucesso" => false, "erro" => "Erro ao preparar login"], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt->bind_param("s", $normalizedEmail);
if (!$stmt->execute()) {
    $stmt->close();
    echo json_encode(["sucesso" => false, "erro" => "Erro ao consultar usuario"], JSON_UNESCAPED_UNICODE);
    exit;
}

$user = ecocoleta_stmt_fetch_one_assoc($stmt);
$stmt->close();
if (!$user) {
    echo json_encode(["sucesso" => false, "erro" => "E-mail ou senha incorretos"], JSON_UNESCAPED_UNICODE);
    exit;
}

$hash = isset($user["senha_hash"]) ? trim((string) $user["senha_hash"]) : "";
if ($hash === "") {
    echo json_encode(["sucesso" => false, "erro" => "Senha no banco em formato invalido. Use recuperar senha ou cadastre de novo."], JSON_UNESCAPED_UNICODE);
    exit;
}

$senhaValida = false;
$senhaValidaPlain = false;
$senhaValidaLegacy = false;

$info = password_get_info($hash);
if (($info["algo"] ?? 0) !== 0) {
    if (password_verify($senha, $hash)) {
        $senhaValida = true;
    }
} elseif ($hash === $senha) {
    $senhaValida = true;
    $senhaValidaPlain = true;
} elseif (preg_match('/^[a-f0-9]{32}$/i', $hash) && md5($senha) === $hash) {
    $senhaValida = true;
    $senhaValidaLegacy = true;
} elseif (preg_match('/^[a-f0-9]{40}$/i', $hash) && sha1($senha) === $hash) {
    $senhaValida = true;
    $senhaValidaLegacy = true;
} elseif (preg_match('/^[a-f0-9]{64}$/i', $hash) && hash('sha256', $senha) === $hash) {
    $senhaValida = true;
    $senhaValidaLegacy = true;
}

if (!$senhaValida) {
    echo json_encode(["sucesso" => false, "erro" => "E-mail ou senha incorretos"], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($senhaValidaPlain || $senhaValidaLegacy) || password_needs_rehash($hash, PASSWORD_DEFAULT)) {
    $novo = password_hash($senha, PASSWORD_DEFAULT);
    $uid = (int) $user["id_usuario"];
    $upd = $conn->prepare("UPDATE usuario SET senha_hash = ? WHERE id_usuario = ?");
    if ($upd) {
        $upd->bind_param("si", $novo, $uid);
        $upd->execute();
    }
}

$_SESSION["usuario_id"] = (int) $user["id_usuario"];
$_SESSION["usuario_nome"] = $user["nome"];
$_SESSION["usuario_email"] = $user["email"];

echo json_encode([
    "sucesso" => true,
    "mensagem" => "Login realizado com sucesso.",
    "usuario" => [
        "id" => (int) $user["id_usuario"],
        "nome" => $user["nome"],
        "email" => $user["email"],
    ],
], JSON_UNESCAPED_UNICODE);
