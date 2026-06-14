<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["sucesso" => false, "erro" => "Metodo nao permitido."], JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($_SESSION["usuario_id"]) || (int) $_SESSION["usuario_id"] <= 0) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Sessao expirada. Faca login novamente.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$uid = (int) $_SESSION["usuario_id"];

$conn->begin_transaction();

try {
    $sqlIe = "DELETE ie FROM item_entrega ie INNER JOIN entrega e ON e.id_entrega = ie.id_entrega WHERE e.id_usuario = ?";
    $stmtIe = $conn->prepare($sqlIe);
    if (!$stmtIe) {
        throw new Exception("Erro ao preparar remocao de itens de entrega.");
    }
    $stmtIe->bind_param("i", $uid);
    if (!$stmtIe->execute()) {
        throw new Exception("Erro ao remover itens de entrega.");
    }

    $stmtE = $conn->prepare("DELETE FROM entrega WHERE id_usuario = ?");
    if (!$stmtE) {
        throw new Exception("Erro ao preparar remocao de entregas.");
    }
    $stmtE->bind_param("i", $uid);
    if (!$stmtE->execute()) {
        throw new Exception("Erro ao remover entregas.");
    }

    $stmtR = $conn->prepare("DELETE FROM resgate WHERE id_usuario = ?");
    if (!$stmtR) {
        throw new Exception("Erro ao preparar remocao de resgates.");
    }
    $stmtR->bind_param("i", $uid);
    if (!$stmtR->execute()) {
        throw new Exception("Erro ao remover resgates.");
    }

    $stmtC = $conn->prepare("DELETE FROM coleta WHERE id_cooperativa = ?");
    if ($stmtC) {
        $stmtC->bind_param("i", $uid);
        if (!$stmtC->execute()) {
            throw new Exception("Erro ao remover coletas da cooperativa.");
        }
    }

    $stmtU = $conn->prepare("DELETE FROM usuario WHERE id_usuario = ?");
    if (!$stmtU) {
        throw new Exception("Erro ao preparar exclusao do usuario.");
    }
    $stmtU->bind_param("i", $uid);
    if (!$stmtU->execute()) {
        throw new Exception("Erro ao excluir usuario: " . $conn->error);
    }
    if ($stmtU->affected_rows === 0) {
        throw new Exception("Usuario nao encontrado.");
    }

    $conn->commit();
} catch (Throwable $e) {
    $conn->rollback();
    echo json_encode([
        "sucesso" => false,
        "erro" => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$_SESSION = [];
if (ini_get("session.use_cookies")) {
    $p = session_get_cookie_params();
    setcookie(session_name(), "", time() - 42000, $p["path"], $p["domain"], $p["secure"], $p["httponly"]);
}
session_destroy();

echo json_encode([
    "sucesso" => true,
    "mensagem" => "Conta excluida com sucesso.",
], JSON_UNESCAPED_UNICODE);
