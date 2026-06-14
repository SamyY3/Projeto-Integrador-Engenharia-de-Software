<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-data.php";
require_once dirname(__DIR__) . "/ecocheck/ecocheck-lib.php";

ecocheck_exigir_token();

function ecocoleta_ensure_admin_plataforma_table(mysqli $conn): bool
{
    $sql = "CREATE TABLE IF NOT EXISTS administrador_plataforma (
        id_admin INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(120) NOT NULL,
        email VARCHAR(160) NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        cargo VARCHAR(120) NOT NULL DEFAULT 'Administrador da plataforma',
        status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ultimo_login DATETIME NULL,
        UNIQUE KEY uq_admin_plataforma_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    if (!@$conn->query($sql)) {
        return false;
    }

    $res = @$conn->query("SELECT COUNT(*) AS total FROM administrador_plataforma");
    $total = 0;
    if ($res) {
        $row = $res->fetch_assoc();
        $total = (int) ($row["total"] ?? 0);
        $res->free();
    }

    if ($total === 0) {
        $senhaDemo = password_hash("EcoPlat@2026", PASSWORD_DEFAULT);
        $stmt = $conn->prepare(
            "INSERT INTO administrador_plataforma (nome, email, senha_hash, cargo)
             VALUES (?, ?, ?, ?)"
        );
        if (!$stmt) {
            return false;
        }
        $nome = "Administrador da Plataforma";
        $email = "admin.plataforma@ecocoleta.local";
        $cargo = "Diretor de operacoes";
        $stmt->bind_param("ssss", $nome, $email, $senhaDemo, $cargo);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) {
            return false;
        }
    }

    return true;
}

if (!ecocoleta_ensure_admin_plataforma_table($conn)) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Nao foi possivel preparar o acesso da plataforma.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$email = mb_strtolower(trim((string) ($_POST["email"] ?? "")), "UTF-8");
$senha = (string) ($_POST["senha"] ?? "");

if ($email === "" || $senha === "") {
    echo json_encode(["sucesso" => false, "erro" => "Preencha e-mail e senha."], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt = $conn->prepare(
    "SELECT id_admin, nome, email, senha_hash, cargo, status
     FROM administrador_plataforma
     WHERE LOWER(email) = ?
     LIMIT 1"
);
if (!$stmt) {
    echo json_encode(["sucesso" => false, "erro" => "Erro ao preparar login."], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt->bind_param("s", $email);
if (!$stmt->execute()) {
    $stmt->close();
    echo json_encode(["sucesso" => false, "erro" => "Erro ao consultar administrador."], JSON_UNESCAPED_UNICODE);
    exit;
}

$admin = ecocoleta_stmt_fetch_one_assoc($stmt);
$stmt->close();

if (!$admin || !password_verify($senha, (string) $admin["senha_hash"])) {
    echo json_encode(["sucesso" => false, "erro" => "E-mail ou senha incorretos."], JSON_UNESCAPED_UNICODE);
    exit;
}

if ((string) $admin["status"] !== "ativo") {
    echo json_encode(["sucesso" => false, "erro" => "Este administrador esta inativo."], JSON_UNESCAPED_UNICODE);
    exit;
}

$idAdmin = (int) $admin["id_admin"];
$_SESSION["ecocoleta_plat_admin_id"] = $idAdmin;
$perfil = ecoplat_obter_perfil_admin($conn, $idAdmin);
if ($perfil) {
    ecoplat_sync_sessao_admin($perfil);
} else {
    $_SESSION["ecocoleta_plat_admin_nome"] = (string) $admin["nome"];
    $_SESSION["ecocoleta_plat_admin_email"] = (string) $admin["email"];
    $_SESSION["ecocoleta_plat_admin_cargo"] = (string) $admin["cargo"];
}

$upd = $conn->prepare("UPDATE administrador_plataforma SET ultimo_login = NOW() WHERE id_admin = ?");
if ($upd) {
    $upd->bind_param("i", $idAdmin);
    $upd->execute();
    $upd->close();
}

echo json_encode([
    "sucesso" => true,
    "mensagem" => "Acesso premium autorizado. Bem-vindo ao painel da plataforma.",
    "admin" => [
        "id" => $idAdmin,
        "nome" => (string) $admin["nome"],
        "email" => (string) $admin["email"],
        "cargo" => (string) $admin["cargo"],
    ],
], JSON_UNESCAPED_UNICODE);
