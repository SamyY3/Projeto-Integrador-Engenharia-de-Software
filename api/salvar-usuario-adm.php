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
require_once dirname(__DIR__) . "/includes/usuarios-plataforma-adm-format.php";

ecoplat_exigir_sessao();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    ecoplat_json_erro("Método não permitido.", 405);
}

$payload = $_POST;
$raw = file_get_contents("php://input");
if (is_string($raw) && $raw !== "") {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $payload = array_merge($payload, $decoded);
    }
}

$id = (int) ($payload["id_usuario"] ?? 0);
$nome = trim((string) ($payload["nome"] ?? ""));
$email = strtolower(trim((string) ($payload["email"] ?? "")));
$tipoUi = strtolower(trim((string) ($payload["tipo"] ?? "")));
$status = strtolower(trim((string) ($payload["status"] ?? "")));

if ($id <= 0) {
    ecoplat_json_erro("Usuário inválido.");
}
if ($nome === "" || mb_strlen($nome) > 120) {
    ecoplat_json_erro("Informe um nome válido.");
}
if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 160) {
    ecoplat_json_erro("Informe um e-mail válido.");
}
if (!in_array($tipoUi, ["admin", "usuario"], true)) {
    ecoplat_json_erro("Tipo inválido.");
}
if (!in_array($status, ["ativo", "inativo"], true)) {
    ecoplat_json_erro("Status inválido.");
}

$parsed = ecoplat_parse_id_usuario_lista($id);

if ($parsed["kind"] === "plataforma") {
    if ($tipoUi !== "admin") {
        ecoplat_json_erro("Administradores da plataforma devem permanecer como Admin.");
    }

    $stmtDup = $conn->prepare(
        "SELECT id_admin FROM administrador_plataforma WHERE email = ? AND id_admin <> ? LIMIT 1"
    );
    if ($stmtDup) {
        $idAdmin = $parsed["id"];
        $stmtDup->bind_param("si", $email, $idAdmin);
        $stmtDup->execute();
        $stmtDup->store_result();
        if ($stmtDup->num_rows > 0) {
            $stmtDup->close();
            ecoplat_json_erro("Este e-mail já está em uso.");
        }
        $stmtDup->close();
    }

    $stmt = $conn->prepare(
        "UPDATE administrador_plataforma SET nome = ?, email = ?, status = ? WHERE id_admin = ?"
    );
    if (!$stmt) {
        ecoplat_json_erro("Não foi possível salvar o administrador.");
    }
    $idAdmin = $parsed["id"];
    $stmt->bind_param("sssi", $nome, $email, $status, $idAdmin);
    if (!$stmt->execute() || $stmt->affected_rows < 0) {
        $stmt->close();
        ecoplat_json_erro("Administrador não encontrado.");
    }
    $stmt->close();

    $sessaoId = (int) ($_SESSION["ecocoleta_plat_admin_id"] ?? 0);
    if ($sessaoId === $idAdmin) {
        $_SESSION["ecocoleta_plat_admin_nome"] = $nome;
        $_SESSION["ecocoleta_plat_admin_email"] = $email;
    }
} else {
    $stmtAtual = $conn->prepare("SELECT tipo_usuario FROM usuario WHERE id_usuario = ? LIMIT 1");
    $tipoAtualDb = "";
    if ($stmtAtual) {
        $idUsuario = $parsed["id"];
        $stmtAtual->bind_param("i", $idUsuario);
        $stmtAtual->execute();
        $rowAtual = ecocoleta_stmt_fetch_assoc($stmtAtual);
        $stmtAtual->close();
        $tipoAtualDb = (string) ($rowAtual["tipo_usuario"] ?? "");
    }

    $tipoDb = ecoplat_tipo_db_from_ui($tipoUi, $tipoAtualDb);

    $stmtDup = $conn->prepare(
        "SELECT id_usuario FROM usuario WHERE email = ? AND id_usuario <> ? LIMIT 1"
    );
    if ($stmtDup) {
        $idUsuario = $parsed["id"];
        $stmtDup->bind_param("si", $email, $idUsuario);
        $stmtDup->execute();
        $stmtDup->store_result();
        if ($stmtDup->num_rows > 0) {
            $stmtDup->close();
            ecoplat_json_erro("Este e-mail já está em uso.");
        }
        $stmtDup->close();
    }

    $temStatus = ecoplat_usuario_tem_coluna_status($conn);
    if ($temStatus) {
        $stmt = $conn->prepare(
            "UPDATE usuario SET nome = ?, email = ?, tipo_usuario = ?, status_conta = ? WHERE id_usuario = ?"
        );
        if (!$stmt) {
            ecoplat_json_erro("Não foi possível salvar o usuário.");
        }
        $idUsuario = $parsed["id"];
        $stmt->bind_param("ssssi", $nome, $email, $tipoDb, $status, $idUsuario);
    } else {
        $stmt = $conn->prepare(
            "UPDATE usuario SET nome = ?, email = ?, tipo_usuario = ? WHERE id_usuario = ?"
        );
        if (!$stmt) {
            ecoplat_json_erro("Não foi possível salvar o usuário.");
        }
        $idUsuario = $parsed["id"];
        $stmt->bind_param("sssi", $nome, $email, $tipoDb, $idUsuario);
    }

    if (!$stmt->execute()) {
        $stmt->close();
        ecoplat_json_erro("Não foi possível salvar o usuário.");
    }
    if ($stmt->affected_rows === 0) {
        $chk = $conn->prepare("SELECT id_usuario FROM usuario WHERE id_usuario = ? LIMIT 1");
        if ($chk) {
            $idUsuario = $parsed["id"];
            $chk->bind_param("i", $idUsuario);
            $chk->execute();
            $chk->store_result();
            $existe = $chk->num_rows > 0;
            $chk->close();
            if (!$existe) {
                $stmt->close();
                ecoplat_json_erro("Usuário não encontrado.");
            }
        }
    }
    $stmt->close();
}

$item = ecoplat_buscar_usuario_formatado($conn, $id);
if ($item === null) {
    ecoplat_json_erro("Usuário não encontrado após salvar.");
}

ecoplat_json_ok(["usuario" => $item]);
