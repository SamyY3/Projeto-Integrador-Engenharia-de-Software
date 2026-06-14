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

ecoplat_exigir_sessao();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    ecoplat_json_erro("Método não permitido.", 405);
}

$id = (int) ($_POST["id_agendamento"] ?? 0);
if ($id <= 0) {
    $raw = file_get_contents("php://input");
    if (is_string($raw) && $raw !== "") {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $id = (int) ($decoded["id_agendamento"] ?? 0);
        }
    }
}

if ($id <= 0) {
    ecoplat_json_erro("Agendamento inválido.");
}

if (!ecoadm_tabela_agendamento_operacional($conn)) {
    ecoplat_json_erro("Módulo de agendamentos indisponível.");
}

$stmt = $conn->prepare("DELETE FROM agendamento_coleta_morador WHERE id_agendamento = ? LIMIT 1");
if (!$stmt) {
    ecoplat_json_erro("Não foi possível excluir o agendamento.");
}

$stmt->bind_param("i", $id);
if (!$stmt->execute() || $stmt->affected_rows < 1) {
    $stmt->close();
    ecoplat_json_erro("Agendamento não encontrado.");
}
$stmt->close();

ecoplat_json_ok(["id_agendamento" => $id]);
