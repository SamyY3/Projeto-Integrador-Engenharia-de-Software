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

$id = (int) ($_POST["id_usuario"] ?? 0);
if ($id <= 0) {
    $raw = file_get_contents("php://input");
    if (is_string($raw) && $raw !== "") {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $id = (int) ($decoded["id_usuario"] ?? 0);
        }
    }
}

if ($id <= 0) {
    ecoplat_json_erro("Usuário inválido.");
}

$parsed = ecoplat_parse_id_usuario_lista($id);

if ($parsed["kind"] === "plataforma") {
    $sessaoId = (int) ($_SESSION["ecocoleta_plat_admin_id"] ?? 0);
    if ($sessaoId === $parsed["id"]) {
        ecoplat_json_erro("Você não pode excluir a conta com a qual está logado.");
    }

    $res = @$conn->query("SELECT COUNT(*) AS c FROM administrador_plataforma");
    $total = 0;
    if ($res) {
        $row = $res->fetch_assoc();
        $total = (int) ($row["c"] ?? 0);
        $res->free();
    }
    if ($total <= 1) {
        ecoplat_json_erro("Não é possível excluir o único administrador da plataforma.");
    }

    $stmt = $conn->prepare("DELETE FROM administrador_plataforma WHERE id_admin = ? LIMIT 1");
    if (!$stmt) {
        ecoplat_json_erro("Não foi possível excluir o administrador.");
    }
    $idAdmin = $parsed["id"];
    $stmt->bind_param("i", $idAdmin);
} else {
    $stmt = $conn->prepare("DELETE FROM usuario WHERE id_usuario = ? LIMIT 1");
    if (!$stmt) {
        ecoplat_json_erro("Não foi possível excluir o usuário.");
    }
    $idUsuario = $parsed["id"];
    $stmt->bind_param("i", $idUsuario);
}

if (!$stmt->execute() || $stmt->affected_rows < 1) {
    $stmt->close();
    ecoplat_json_erro("Registro não encontrado ou possui vínculos que impedem a exclusão.");
}
$stmt->close();

ecoplat_json_ok(["id_usuario" => $id]);
