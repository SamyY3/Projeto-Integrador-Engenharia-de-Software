<?php

ini_set("display_errors", "0");
error_reporting(0);

session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/notificacoes_helper.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";

if (empty($_SESSION["usuario_id"]) || (int) $_SESSION["usuario_id"] <= 0) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Sessao expirada. Faca login novamente.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$uid = (int) $_SESSION["usuario_id"];

$acao = "";
if (isset($_GET["acao"])) {
    $acao = trim((string) $_GET["acao"]);
} elseif (isset($_POST["acao"])) {
    $acao = trim((string) $_POST["acao"]);
}

function respostaErroTabela(mysqli $conn): void
{
    if ($conn->errno === 1146) {
        echo json_encode([
            "sucesso" => false,
            "erro" => "Tabela de agendamentos ausente. Execute agendamento_coleta_tab.sql no banco ecocoleta.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($acao === "listar") {
    $inicio = trim((string) ($_GET["inicio"] ?? ""));
    $fim = trim((string) ($_GET["fim"] ?? ""));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $inicio) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fim)) {
        echo json_encode(["sucesso" => false, "erro" => "Datas invalidas."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($inicio > $fim) {
        echo json_encode(["sucesso" => false, "erro" => "Intervalo de datas invalido."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sql = "SELECT id_agendamento AS id, DATE_FORMAT(data_coleta, '%Y-%m-%d') AS data_coleta, slot_ordem
            FROM agendamento_coleta_morador
            WHERE id_usuario = ? AND data_coleta >= ? AND data_coleta <= ?
            ORDER BY data_coleta, slot_ordem";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        respostaErroTabela($conn);
        echo json_encode(["sucesso" => false, "erro" => "Erro ao preparar listagem."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("iss", $uid, $inicio, $fim);
    if (!$stmt->execute()) {
        respostaErroTabela($conn);
        echo json_encode(["sucesso" => false, "erro" => "Erro ao listar agendamentos."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $result = $stmt->get_result();
    if ($result === false) {
        echo json_encode(["sucesso" => false, "erro" => "Consulta nao suportada."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $lista = [];
    while ($row = $result->fetch_assoc()) {
        $lista[] = [
            "id" => (int) $row["id"],
            "data_coleta" => $row["data_coleta"],
            "slot_ordem" => (int) $row["slot_ordem"],
        ];
    }
    echo json_encode(["sucesso" => true, "agendamentos" => $lista], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "criar") {
    $dataColeta = trim((string) ($_POST["data_coleta"] ?? ""));
    $slotOrd = isset($_POST["slot_ordem"]) ? (int) $_POST["slot_ordem"] : -1;

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataColeta)) {
        echo json_encode(["sucesso" => false, "erro" => "Data invalida."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($slotOrd < 0 || $slotOrd > 4) {
        echo json_encode(["sucesso" => false, "erro" => "Horario invalido."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $hoje = (new DateTime("today"))->format("Y-m-d");
    if ($dataColeta < $hoje) {
        echo json_encode(["sucesso" => false, "erro" => "Nao e possivel agendar no passado."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!ecocoleta_usuario_tem_endereco_coleta($conn, $uid)) {
        echo json_encode([
            "sucesso" => false,
            "erro" => "Cadastre seu endereco no perfil antes de agendar uma coleta.",
            "erro_codigo" => "sem_endereco",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sql = "INSERT INTO agendamento_coleta_morador (id_usuario, data_coleta, slot_ordem) VALUES (?, ?, ?)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        respostaErroTabela($conn);
        echo json_encode(["sucesso" => false, "erro" => "Erro ao preparar agendamento."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("isi", $uid, $dataColeta, $slotOrd);
    if (!$stmt->execute()) {
        if ($conn->errno === 1062) {
            echo json_encode([
                "sucesso" => false,
                "erro" => "Voce ja tem agendamento neste horario.",
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        respostaErroTabela($conn);
        echo json_encode(["sucesso" => false, "erro" => "Nao foi possivel agendar."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $idAgendamento = (int) $conn->insert_id;
    if ($idAgendamento > 0) {
        ecocoleta_notif_agendamento($conn, $uid, $idAgendamento, $dataColeta, $slotOrd);
        ecocoleta_notif_agendamento_para_admins($conn, $idAgendamento, $uid, $dataColeta, $slotOrd);
    }

    echo json_encode([
        "sucesso" => true,
        "id" => $idAgendamento,
        "id_agendamento" => $idAgendamento,
        "mensagem" => "Coleta agendada com sucesso.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "cancelar") {
    $idAg = isset($_POST["id_agendamento"]) ? (int) $_POST["id_agendamento"] : 0;
    if ($idAg <= 0) {
        echo json_encode(["sucesso" => false, "erro" => "Agendamento invalido."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sql = "DELETE FROM agendamento_coleta_morador WHERE id_agendamento = ? AND id_usuario = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        respostaErroTabela($conn);
        echo json_encode(["sucesso" => false, "erro" => "Erro ao preparar cancelamento."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("ii", $idAg, $uid);
    if (!$stmt->execute()) {
        respostaErroTabela($conn);
        echo json_encode(["sucesso" => false, "erro" => "Nao foi possivel cancelar."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($stmt->affected_rows < 1) {
        echo json_encode(["sucesso" => false, "erro" => "Agendamento nao encontrado."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(["sucesso" => true, "mensagem" => "Agendamento cancelado."], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(["sucesso" => false, "erro" => "Acao invalida."], JSON_UNESCAPED_UNICODE);
