<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/notificacoes_helper.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-helpers.php";

if (empty($_SESSION["ecoponto_admin_id"]) || (int) $_SESSION["ecoponto_admin_id"] <= 0) {
    ecoadm_json_erro("Sessao administrativa expirada. Faca login novamente.");
}

$idAdmin = (int) $_SESSION["ecoponto_admin_id"];
$acao = trim((string) ($_POST["acao"] ?? $_GET["acao"] ?? ""));

if ($acao === "") {
    ecoadm_json_erro("Informe acao.");
}

if (!ecocoleta_ensure_notificacao_admin_table($conn)) {
    ecoadm_json_erro("Modulo de notificacoes indisponivel.");
}

if ($acao === "listar") {
    $stmt = $conn->prepare(
        "SELECT id_notificacao, tipo, prioridade, titulo, mensagem, icone, badge_texto, lida, criado_em
         FROM notificacao_admin
         WHERE id_admin = ?
         ORDER BY criado_em DESC, id_notificacao DESC
         LIMIT 40"
    );
    if (!$stmt) {
        ecoadm_json_erro("Erro ao carregar notificacoes.");
    }

    $stmt->bind_param("i", $idAdmin);
    if (!$stmt->execute()) {
        $stmt->close();
        ecoadm_json_erro("Erro ao consultar notificacoes.");
    }

    $importantes = [];
    $outras = [];
    $naoLidas = 0;

    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $item = ecocoleta_notif_formatar_item_admin($row);
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

    ecoadm_json_ok([
        "nao_lidas" => $naoLidas,
        "importantes" => $importantes,
        "outras" => $outras,
    ]);
}

if ($acao === "marcar_lida") {
    $id = (int) ($_POST["id_notificacao"] ?? 0);
    if ($id <= 0) {
        ecoadm_json_erro("Notificacao invalida.");
    }

    $stmt = $conn->prepare(
        "UPDATE notificacao_admin SET lida = 1, lida_em = NOW()
         WHERE id_notificacao = ? AND id_admin = ? AND lida = 0"
    );
    if ($stmt) {
        $stmt->bind_param("ii", $id, $idAdmin);
        $stmt->execute();
        $stmt->close();
    }

    ecoadm_json_ok(["mensagem" => "Notificacao marcada como lida."]);
}

if ($acao === "marcar_todas_lidas") {
    $stmt = $conn->prepare(
        "UPDATE notificacao_admin SET lida = 1, lida_em = NOW()
         WHERE id_admin = ? AND lida = 0"
    );
    if ($stmt) {
        $stmt->bind_param("i", $idAdmin);
        $stmt->execute();
        $stmt->close();
    }

    ecoadm_json_ok(["nao_lidas" => 0, "mensagem" => "Todas as notificacoes foram lidas."]);
}

ecoadm_json_erro("Acao invalida.");
