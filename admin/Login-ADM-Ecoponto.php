<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";
require_once dirname(__DIR__) . "/ecocheck/ecocheck-lib.php";

ecocheck_exigir_token();

function ecocoleta_ensure_admin_ecoponto_table(mysqli $conn): bool
{
    $sql = "CREATE TABLE IF NOT EXISTS administrador_ecoponto (
        id_admin INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(120) NOT NULL,
        email VARCHAR(160) NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        nome_ecoponto VARCHAR(160) NOT NULL DEFAULT 'EcoPonto parceiro',
        status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ultimo_login DATETIME NULL,
        UNIQUE KEY uq_admin_ecoponto_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    if (!@$conn->query($sql)) {
        return false;
    }

    $res = @$conn->query("SELECT COUNT(*) AS total FROM administrador_ecoponto");
    $total = 0;
    if ($res) {
        $row = $res->fetch_assoc();
        $total = (int) ($row["total"] ?? 0);
        $res->free();
    }

    if ($total === 0) {
        $senhaDemo = password_hash("EcoPonto@123", PASSWORD_DEFAULT);
        $stmt = $conn->prepare(
            "INSERT INTO administrador_ecoponto (nome, email, senha_hash, nome_ecoponto)
             VALUES (?, ?, ?, ?)"
        );
        if (!$stmt) {
            return false;
        }
        $nome = "Administrador EcoPonto";
        $email = "admin.ecoponto@ecocoleta.local";
        $ecoponto = ecoadm_pev_padrao_nome();
        $stmt->bind_param("ssss", $nome, $email, $senhaDemo, $ecoponto);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) {
            return false;
        }
    }

    return true;
}

if (!ecocoleta_ensure_admin_ecoponto_table($conn)) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Nao foi possivel preparar o acesso administrativo.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

ecoadm_garantir_colunas_admin($conn);
ecoadm_garantir_schema_integracao($conn);

$email = mb_strtolower(trim((string) ($_POST["email"] ?? "")), "UTF-8");
$senha = (string) ($_POST["senha"] ?? "");

if ($email === "" || $senha === "") {
    echo json_encode(["sucesso" => false, "erro" => "Preencha e-mail e senha."], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt = $conn->prepare(
    "SELECT id_admin, nome, email, senha_hash, nome_ecoponto, status" .
    (ecoadm_admin_tem_coluna($conn, "foto_perfil") ? ", foto_perfil" : "") . "
     FROM administrador_ecoponto
     WHERE LOWER(email) = ?
     LIMIT 1"
);
if (!$stmt) {
    echo json_encode(["sucesso" => false, "erro" => "Erro ao preparar login administrativo."], JSON_UNESCAPED_UNICODE);
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
$_SESSION["ecoponto_admin_id"] = $idAdmin;
$_SESSION["ecoponto_admin_nome"] = (string) $admin["nome"];
$_SESSION["ecoponto_admin_email"] = (string) $admin["email"];
$_SESSION["ecoponto_admin_nome_ecoponto"] = (string) $admin["nome_ecoponto"];
unset($_SESSION["ecoadm_schema_ok"], $_SESSION["ecoponto_admin_id_pev"]);

$ctxLogin = ecoadm_obter_contexto($conn, $idAdmin);
$_SESSION["ecoponto_admin_id_pev"] = (int) ($ctxLogin["id_pev"] ?? 0);
$_SESSION["ecoponto_admin_nome_ecoponto"] = (string) (
    $ctxLogin["pev"]["nome_ponto"] ?? ecoadm_pev_padrao_nome()
);

if (ecoadm_admin_tem_coluna($conn, "foto_perfil") && !empty($admin["foto_perfil"])) {
    $_SESSION["ecoponto_admin_foto"] = (string) $admin["foto_perfil"];
}

$upd = $conn->prepare("UPDATE administrador_ecoponto SET ultimo_login = NOW() WHERE id_admin = ?");
if ($upd) {
    $upd->bind_param("i", $idAdmin);
    $upd->execute();
    $upd->close();
}

echo json_encode([
    "sucesso" => true,
    "mensagem" => "Login administrativo realizado com sucesso.",
    "admin" => [
        "id" => $idAdmin,
        "nome" => (string) $admin["nome"],
        "email" => (string) $admin["email"],
        "ecoponto" => (string) ($ctxLogin["pev"]["nome_ponto"] ?? $admin["nome_ecoponto"]),
        "endereco" => (string) ($ctxLogin["pev"]["endereco"] ?? ""),
    ],
], JSON_UNESCAPED_UNICODE);
