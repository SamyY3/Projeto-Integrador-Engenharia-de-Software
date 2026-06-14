<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/notificacoes_helper.php";

if (empty($_SESSION["usuario_id"]) || (int) $_SESSION["usuario_id"] <= 0) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Sessao expirada. Faca login novamente.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$usuarioId = (int) $_SESSION["usuario_id"];
$acao = trim((string) ($_POST["acao"] ?? $_GET["acao"] ?? ""));

if ($acao === "") {
    echo json_encode(["sucesso" => false, "erro" => "Informe acao."], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!ecocoleta_ensure_notificacao_table($conn)) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Nao foi possivel preparar o modulo de notificacoes.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "listar") {
    ecocoleta_notif_sincronizar_atividade($conn, $usuarioId);

    $stmt = $conn->prepare(
        "SELECT id_notificacao, tipo, prioridade, titulo, mensagem, icone, badge_texto, lida, criado_em
         FROM notificacao
         WHERE id_usuario = ?
         ORDER BY criado_em DESC, id_notificacao DESC
         LIMIT 40"
    );
    if (!$stmt) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao carregar notificacoes."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt->bind_param("i", $usuarioId);
    if (!$stmt->execute()) {
        $stmt->close();
        echo json_encode(["sucesso" => false, "erro" => "Erro ao consultar notificacoes."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $importantes = [];
    $outras = [];
    $naoLidas = 0;

    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $item = ecocoleta_notif_formatar_item($row);
        if (!$item["lida"]) {
            $naoLidas++;
        }
        if ($item["prioridade"] === "importante") {
            $importantes[] = $item;
        } else {
            $outras[] = $item;
        }
    }
    $stmt->close();

    echo json_encode([
        "sucesso" => true,
        "nao_lidas" => $naoLidas,
        "importantes" => $importantes,
        "outras" => $outras,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "marcar_lida") {
    $id = (int) ($_POST["id_notificacao"] ?? 0);
    if ($id <= 0) {
        echo json_encode(["sucesso" => false, "erro" => "Notificacao invalida."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $conn->prepare(
        "UPDATE notificacao SET lida = 1, lida_em = NOW()
         WHERE id_notificacao = ? AND id_usuario = ? AND lida = 0"
    );
    if (!$stmt) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao atualizar notificacao."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("ii", $id, $usuarioId);
    $stmt->execute();
    $stmt->close();

    echo json_encode(["sucesso" => true], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "marcar_todas_lidas") {
    $stmt = $conn->prepare(
        "UPDATE notificacao SET lida = 1, lida_em = NOW()
         WHERE id_usuario = ? AND lida = 0"
    );
    if (!$stmt) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao marcar notificacoes."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("i", $usuarioId);
    $stmt->execute();
    $stmt->close();

    echo json_encode(["sucesso" => true, "nao_lidas" => 0], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "contar_nao_lidas") {
    ecocoleta_notif_sincronizar_atividade($conn, $usuarioId);

    $stmt = $conn->prepare("SELECT COUNT(*) AS total FROM notificacao WHERE id_usuario = ? AND lida = 0");
    if (!$stmt) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao contar notificacoes."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("i", $usuarioId);
    $stmt->execute();
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    echo json_encode([
        "sucesso" => true,
        "nao_lidas" => $row ? (int) $row["total"] : 0,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(["sucesso" => false, "erro" => "Acao invalida."], JSON_UNESCAPED_UNICODE);
