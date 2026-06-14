<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";
require_once dirname(__DIR__) . "/includes/notificacoes_helper.php";
require_once dirname(__DIR__) . "/includes/agendamentos-plataforma-adm-format.php";

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

$id = (int) ($payload["id_agendamento"] ?? 0);
$status = strtolower(trim((string) ($payload["status"] ?? "")));
$tipo = strtolower(trim((string) ($payload["tipo"] ?? "")));
$dataColeta = trim((string) ($payload["data_coleta"] ?? ""));
$slot = (int) ($payload["slot_ordem"] ?? -1);

if ($id <= 0) {
    ecoplat_json_erro("Agendamento inválido.");
}

if (!in_array($status, ["confirmado", "andamento", "concluida", "cancelado"], true)) {
    ecoplat_json_erro("Status inválido.");
}

if ($tipo !== "prefeitura") {
    $tipo = "caminhao";
}

$idPev = 0;
$nomePev = "";
$stmtPev = $conn->prepare(
    "SELECT COALESCE(a.id_pev, 0) AS id_pev, COALESCE(NULLIF(TRIM(p.nome_ponto), ''), '') AS nome_ponto
     FROM agendamento_coleta_morador a
     LEFT JOIN ponto_entrega p ON p.id_pev = a.id_pev
     WHERE a.id_agendamento = ? LIMIT 1"
);
if ($stmtPev) {
    $stmtPev->bind_param("i", $id);
    if ($stmtPev->execute()) {
        $rowPev = ecocoleta_stmt_fetch_one_assoc($stmtPev);
        if ($rowPev) {
            $idPev = (int) ($rowPev["id_pev"] ?? 0);
            $nomePev = trim((string) ($rowPev["nome_ponto"] ?? ""));
        }
    }
    $stmtPev->close();
}
$responsavel = ecoadm_rotulo_responsavel($tipo, $nomePev);

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $dataColeta)) {
    ecoplat_json_erro("Data de coleta inválida.");
}

if ($slot < 0 || $slot > 4) {
    ecoplat_json_erro("Horário inválido.");
}

ecoadm_garantir_schema_integracao($conn);
ecoagend_garantir_enum_cancelado($conn);

if (!ecoadm_tabela_agendamento_operacional($conn)) {
    ecoplat_json_erro("Módulo de agendamentos indisponível.");
}

$stmt = $conn->prepare(
    "UPDATE agendamento_coleta_morador
     SET data_coleta = ?, slot_ordem = ?, status_coleta = ?, tipo_coleta = ?, responsavel = ?
     WHERE id_agendamento = ?"
);
if (!$stmt) {
    ecoplat_json_erro("Não foi possível atualizar o agendamento.");
}

$stmt->bind_param("sisssi", $dataColeta, $slot, $status, $tipo, $responsavel, $id);
if (!$stmt->execute()) {
    $stmt->close();
    ecoplat_json_erro("Não foi possível salvar. Verifique se o horário já está ocupado.");
}
$stmt->close();

if ($tipo === "prefeitura" && ecoadm_agendamento_tem_coluna($conn, "id_pev")) {
    @$conn->query(
        "UPDATE agendamento_coleta_morador SET id_pev = NULL WHERE id_agendamento = " . (int) $id
    );
}

$rows = ecoadm_listar_coletas($conn, 0, []);
$item = null;
foreach ($rows as $row) {
    if ((int) ($row["id_agendamento"] ?? 0) === $id) {
        $item = ecoplat_formatar_agendamento_item($row);
        break;
    }
}

if ($item === null) {
    ecoplat_json_erro("Agendamento não encontrado após salvar.");
}

ecoplat_json_ok(["agendamento" => $item]);
