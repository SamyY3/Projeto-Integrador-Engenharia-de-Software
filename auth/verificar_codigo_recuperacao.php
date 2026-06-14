<?php
ini_set("display_errors", "0");
error_reporting(0);

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";

$email = trim((string) ($_POST["email"] ?? ""));
$codigo = preg_replace("/\D/", "", (string) ($_POST["codigo"] ?? ""));

if ($email === "" || strlen($codigo) !== 6) {
    echo json_encode(["sucesso" => false, "erro" => "Codigo invalido"], JSON_UNESCAPED_UNICODE);
    exit;
}

$sql = "SELECT id_usuario, codigo_recuperacao_hash, codigo_recuperacao_expira,
        (codigo_recuperacao_expira IS NOT NULL AND codigo_recuperacao_expira > NOW()) AS prazo_ok
        FROM usuario WHERE email = ? LIMIT 1";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt->bind_param("s", $email);
if (!$stmt->execute()) {
    echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
    exit;
}

$result = $stmt->get_result();
if ($result === false) {
    echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
    exit;
}

$row = $result->fetch_assoc();
if (!$row) {
    echo json_encode(["sucesso" => false, "erro" => "Codigo invalido"], JSON_UNESCAPED_UNICODE);
    exit;
}

$hash = $row["codigo_recuperacao_hash"] ?? "";
$expira = $row["codigo_recuperacao_expira"] ?? "";
if ($hash === "" || $expira === "") {
    echo json_encode(["sucesso" => false, "erro" => "Codigo invalido"], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!password_verify($codigo, $hash)) {
    echo json_encode(["sucesso" => false, "erro" => "Codigo invalido"], JSON_UNESCAPED_UNICODE);
    exit;
}

if ((int) ($row["prazo_ok"] ?? 0) !== 1) {
    echo json_encode(["sucesso" => false, "erro" => "Codigo expirado"], JSON_UNESCAPED_UNICODE);
    exit;
}

$resetToken = bin2hex(random_bytes(32));
$resetExpira = date("Y-m-d H:i:s", time() + 1800);

$sqlUp = "UPDATE usuario SET reset_token = ?, reset_token_expira = ?, codigo_recuperacao_hash = NULL, codigo_recuperacao_expira = NULL WHERE id_usuario = ?";
$stmtUp = $conn->prepare($sqlUp);
if (!$stmtUp) {
    echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
    exit;
}

$uid = (int) $row["id_usuario"];
$stmtUp->bind_param("ssi", $resetToken, $resetExpira, $uid);
if (!$stmtUp->execute()) {
    $err = $conn->error;
    if (stripos($err, "Unknown column") !== false) {
        echo json_encode(["sucesso" => false, "erro" => "Banco precisa das colunas de recuperacao"], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

echo json_encode([
    "sucesso" => true,
    "mensagem" => "OK",
    "reset_token" => $resetToken,
], JSON_UNESCAPED_UNICODE);
