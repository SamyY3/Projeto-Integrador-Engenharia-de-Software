<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/notificacoes_helper.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";
require_once dirname(__DIR__) . "/includes/ecoponto-agendamento.php";
require_once dirname(__DIR__) . "/includes/balanca-agendamento.php";
require_once dirname(__DIR__) . "/includes/pontuacao-coleta.php";

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

function ecocoleta_ensure_agendamento_coleta_table(mysqli $conn): bool
{
    $sql = "CREATE TABLE IF NOT EXISTS agendamento_coleta_morador (
        id_agendamento INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        data_coleta DATE NOT NULL,
        slot_ordem TINYINT UNSIGNED NOT NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_agendamento_usuario_data_slot (id_usuario, data_coleta, slot_ordem),
        KEY idx_agendamento_usuario_data (id_usuario, data_coleta),
        CONSTRAINT fk_agendamento_coleta_usuario
            FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
            ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    return (bool) @$conn->query($sql);
}

if (!ecocoleta_tabela_existe($conn, "agendamento_coleta_morador") && !ecocoleta_ensure_agendamento_coleta_table($conn)) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Modulo de agendamento indisponivel. Atualize o banco de dados.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

ecoadm_garantir_schema_integracao($conn);

if ($acao === "listar") {
    $desde = trim((string) ($_GET["desde"] ?? $_POST["desde"] ?? date("Y-m-d")));
    $ate = trim((string) ($_GET["ate"] ?? $_POST["ate"] ?? ""));

    if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $desde)) {
        $desde = date("Y-m-d");
    }

    $sql = "SELECT id_agendamento, data_coleta, slot_ordem
            FROM agendamento_coleta_morador
            WHERE id_usuario = ? AND data_coleta >= ?";
    if ($ate !== "" && preg_match("/^\d{4}-\d{2}-\d{2}$/", $ate)) {
        $sql .= " AND data_coleta <= ?";
    }
    $sql .= " ORDER BY data_coleta ASC, slot_ordem ASC";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao listar agendamentos."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($ate !== "" && preg_match("/^\d{4}-\d{2}-\d{2}$/", $ate)) {
        $stmt->bind_param("iss", $usuarioId, $desde, $ate);
    } else {
        $stmt->bind_param("is", $usuarioId, $desde);
    }

    if (!$stmt->execute()) {
        $stmt->close();
        echo json_encode(["sucesso" => false, "erro" => "Erro ao consultar agendamentos."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $lista = [];
    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $slot = (int) $row["slot_ordem"];
        $lista[] = [
            "id_agendamento" => (int) $row["id_agendamento"],
            "data_coleta" => (string) $row["data_coleta"],
            "slot_ordem" => $slot,
            "faixa_horario" => ecocoleta_faixa_horario_coleta($slot),
        ];
    }
    $stmt->close();

    echo json_encode([
        "sucesso" => true,
        "agendamentos" => $lista,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["sucesso" => false, "erro" => "Use POST para esta acao."], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "agendar") {
    ecoponto_garantir_coluna_agendamento_residuo($conn);

    $dataColeta = trim((string) ($_POST["data_coleta"] ?? ""));
    $slotOrdem = (int) ($_POST["slot_ordem"] ?? -1);
    $idPev = (int) ($_POST["id_pev"] ?? 0);
    $tiposResiduo = ecoponto_normalizar_tipos_residuo((string) ($_POST["tipo_residuo"] ?? ""));
    $tipoResiduo = ecoponto_tipos_residuo_para_storage($tiposResiduo);

    if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $dataColeta)) {
        echo json_encode(["sucesso" => false, "erro" => "Data invalida."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($slotOrdem < 0 || $slotOrdem > 4) {
        echo json_encode(["sucesso" => false, "erro" => "Horario invalido."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $hoje = date("Y-m-d");
    if ($dataColeta < $hoje) {
        echo json_encode([
            "sucesso" => false,
            "erro" => "Nao e possivel agendar coleta em data passada.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!ecocoleta_usuario_tem_endereco_coleta($conn, $usuarioId)) {
        echo json_encode([
            "sucesso" => false,
            "erro" => "Cadastre seu endereco no perfil antes de agendar uma coleta.",
            "erro_codigo" => "sem_endereco",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($tiposResiduo === []) {
        echo json_encode([
            "sucesso" => false,
            "erro" => "Selecione ao menos um tipo de residuo.",
            "erro_codigo" => "sem_residuo",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($idPev <= 0) {
        $payload = ecoponto_payload_agendamento($conn, $usuarioId, $tiposResiduo[0]);
        $idPev = (int) ($payload["sugerido_id_pev"] ?? 0);
    }

    if ($idPev <= 0) {
        echo json_encode([
            "sucesso" => false,
            "erro" => "Nenhum EcoPonto disponivel para este tipo de residuo.",
            "erro_codigo" => "sem_ecoponto",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!ecoponto_pev_aceita_todos_residuos($conn, $idPev, $tiposResiduo)) {
        $payload = ecoponto_payload_agendamento($conn, $usuarioId, $tiposResiduo[0]);
        $lista = $payload["ecopontos"] ?? [];
        foreach ($tiposResiduo as $tipoItem) {
            if (ecoponto_pev_aceita_residuo($conn, $idPev, $tipoItem)) {
                continue;
            }
            $alt = ecoponto_encontrar_para_residuo(is_array($lista) ? $lista : [], $tipoItem, $idPev);
            if ($alt) {
                $idPev = (int) ($alt["id_pev"] ?? 0);
            }
            break;
        }
    }

    if ($idPev <= 0 || !ecoponto_pev_aceita_todos_residuos($conn, $idPev, $tiposResiduo)) {
        echo json_encode([
            "sucesso" => false,
            "erro" => "O EcoPonto selecionado nao recebe este tipo de residuo.",
            "erro_codigo" => "residuo_nao_aceito",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    coleta_garantir_schema_pontuacao($conn);

    $somentePendente = in_array(strtolower((string) ($_POST["somente_pendente"] ?? "")), ["1", "true", "sim", "yes"], true);
    $statusInicial = $somentePendente ? "pendente" : "confirmado";

    $temIdPev = ecoadm_agendamento_tem_coluna($conn, "id_pev");
    $temTipoResiduo = ecoadm_agendamento_tem_coluna($conn, "tipo_residuo");

    $cols = ["id_usuario", "data_coleta", "slot_ordem"];
    $placeholders = ["?", "?", "?"];
    $types = "isi";
    $params = [$usuarioId, $dataColeta, $slotOrdem];

    if (ecoadm_agendamento_tem_coluna($conn, "status_coleta")) {
        $cols[] = "status_coleta";
        $placeholders[] = "?";
        $types .= "s";
        $params[] = $statusInicial;
    }

    if ($temIdPev) {
        $cols[] = "id_pev";
        $placeholders[] = "?";
        $types .= "i";
        $params[] = $idPev;
    }
    if ($temTipoResiduo) {
        $cols[] = "tipo_residuo";
        $placeholders[] = "?";
        $types .= "s";
        $params[] = $tipoResiduo;
    }

    $sqlIns = "INSERT INTO agendamento_coleta_morador (" . implode(", ", $cols) . ")
               VALUES (" . implode(", ", $placeholders) . ")";
    $stmt = $conn->prepare($sqlIns);
    if ($stmt) {
        $stmt->bind_param($types, ...$params);
    }

    if (!$stmt) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao agendar coleta."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!$stmt->execute()) {
        if ((int) $conn->errno === 1062) {
            $stmt->close();
            echo json_encode([
                "sucesso" => false,
                "erro" => "Este horario ja esta agendado.",
                "erro_codigo" => "ja_agendado",
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $stmt->close();
        echo json_encode(["sucesso" => false, "erro" => "Erro ao salvar agendamento."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $idAgendamento = (int) $conn->insert_id;
    $stmt->close();

    if ($idAgendamento > 0) {
        ecocoleta_notif_agendamento($conn, $usuarioId, $idAgendamento, $dataColeta, $slotOrdem);
        ecocoleta_notif_agendamento_para_admins(
            $conn,
            $idAgendamento,
            $usuarioId,
            $dataColeta,
            $slotOrdem
        );
    }

    $mensagem = $somentePendente
        ? "Coleta criada com status pendente. Informe o peso na balança para continuar."
        : "Coleta agendada com sucesso.";

    echo json_encode([
        "sucesso" => true,
        "mensagem" => $mensagem,
        "id_agendamento" => $idAgendamento,
        "data_coleta" => $dataColeta,
        "slot_ordem" => $slotOrdem,
        "faixa_horario" => ecocoleta_faixa_horario_coleta($slotOrdem),
        "id_pev" => $idPev,
        "tipo_residuo" => $tipoResiduo,
        "status_coleta" => $statusInicial,
        "notificacao_criada" => $idAgendamento > 0,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "atualizar_balanca") {
    coleta_garantir_schema_pontuacao($conn);

    $idAgendamento = (int) ($_POST["id_agendamento"] ?? 0);
    $pesoInformado = round((float) ($_POST["peso_pendente_kg"] ?? $_POST["peso_informado_kg"] ?? 0), 2);
    $tiposResiduo = ecoponto_normalizar_tipos_residuo((string) ($_POST["tipo_residuo"] ?? ""));
    $tipoResiduo = ecoponto_tipos_residuo_para_storage($tiposResiduo);

    if ($idAgendamento <= 0) {
        echo json_encode(["sucesso" => false, "erro" => "Agendamento invalido."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($pesoInformado < 0.1) {
        echo json_encode(["sucesso" => false, "erro" => "Informe um peso valido (minimo 0,1 kg)."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmtChk = $conn->prepare(
        "SELECT id_agendamento, status_coleta FROM agendamento_coleta_morador
         WHERE id_agendamento = ? AND id_usuario = ? LIMIT 1"
    );
    if (!$stmtChk) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao validar agendamento."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmtChk->bind_param("ii", $idAgendamento, $usuarioId);
    if (!$stmtChk->execute()) {
        $stmtChk->close();
        echo json_encode(["sucesso" => false, "erro" => "Agendamento nao encontrado."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $rowChk = ecocoleta_stmt_fetch_one_assoc($stmtChk);
    $stmtChk->close();
    if (!$rowChk) {
        echo json_encode(["sucesso" => false, "erro" => "Agendamento nao encontrado."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $statusAtual = (string) ($rowChk["status_coleta"] ?? "");
    if (!in_array($statusAtual, ["pendente", "confirmado", "aguardando_validacao"], true)) {
        echo json_encode(["sucesso" => false, "erro" => "Este agendamento nao pode ser atualizado na balanca."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $estimativa = coleta_calcular_pontos($pesoInformado, $tiposResiduo, true);

    $sets = [];
    $types = "";
    $params = [];

    if (ecoadm_agendamento_tem_coluna($conn, "peso_pendente_kg")) {
        $sets[] = "peso_pendente_kg = ?";
        $types .= "d";
        $params[] = $pesoInformado;
    }
    if (ecoadm_agendamento_tem_coluna($conn, "pontos_estimados")) {
        $sets[] = "pontos_estimados = ?";
        $types .= "i";
        $params[] = (int) $estimativa["total"];
    }
    if (ecoadm_agendamento_tem_coluna($conn, "pontos_pendentes")) {
        $sets[] = "pontos_pendentes = ?";
        $types .= "i";
        $params[] = (int) $estimativa["total"];
    }
    if (ecoadm_agendamento_tem_coluna($conn, "peso_status")) {
        $sets[] = "peso_status = 'pendente'";
    }
    if (ecoadm_agendamento_tem_coluna($conn, "status_validacao")) {
        $sets[] = "status_validacao = 'aguardando'";
    }
    if ($tipoResiduo !== "" && ecoadm_agendamento_tem_coluna($conn, "tipo_residuo")) {
        $sets[] = "tipo_residuo = ?";
        $types .= "s";
        $params[] = $tipoResiduo;
    }
    if (ecoadm_agendamento_tem_coluna($conn, "status_coleta")) {
        $sets[] = "status_coleta = 'aguardando_validacao'";
    }

    if ($sets === []) {
        echo json_encode(["sucesso" => false, "erro" => "Schema de balanca indisponivel."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sqlUp = "UPDATE agendamento_coleta_morador SET " . implode(", ", $sets) .
        " WHERE id_agendamento = ? AND id_usuario = ? LIMIT 1";
    $types .= "ii";
    $params[] = $idAgendamento;
    $params[] = $usuarioId;

    $stmtUp = $conn->prepare($sqlUp);
    if (!$stmtUp) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao salvar peso na balanca."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmtUp->bind_param($types, ...$params);
    if (!$stmtUp->execute() || $stmtUp->affected_rows === 0) {
        $stmtUp->close();
        echo json_encode(["sucesso" => false, "erro" => "Nao foi possivel salvar o peso informado."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmtUp->close();

    echo json_encode([
        "sucesso" => true,
        "mensagem" => "Peso registrado! Os EcoPontos serao creditados apos o EcoPonto confirmar o recebimento.",
        "id_agendamento" => $idAgendamento,
        "peso_informado_kg" => $pesoInformado,
        "pontos_estimados" => (int) $estimativa["total"],
        "detalhe_estimativa" => $estimativa["detalhe"],
        "status_coleta" => "aguardando_validacao",
        "simulacao" => false,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "cancelar") {
    $idAgendamento = (int) ($_POST["id_agendamento"] ?? 0);
    $dataColeta = trim((string) ($_POST["data_coleta"] ?? ""));
    $slotOrdem = (int) ($_POST["slot_ordem"] ?? -1);

    if ($idAgendamento > 0) {
        $stmt = $conn->prepare(
            "DELETE FROM agendamento_coleta_morador
             WHERE id_agendamento = ? AND id_usuario = ?"
        );
        if (!$stmt) {
            echo json_encode(["sucesso" => false, "erro" => "Erro ao cancelar."], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $stmt->bind_param("ii", $idAgendamento, $usuarioId);
    } elseif (preg_match("/^\d{4}-\d{2}-\d{2}$/", $dataColeta) && $slotOrdem >= 0 && $slotOrdem <= 4) {
        $stmt = $conn->prepare(
            "DELETE FROM agendamento_coleta_morador
             WHERE id_usuario = ? AND data_coleta = ? AND slot_ordem = ?"
        );
        if (!$stmt) {
            echo json_encode(["sucesso" => false, "erro" => "Erro ao cancelar."], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $stmt->bind_param("isi", $usuarioId, $dataColeta, $slotOrdem);
    } else {
        echo json_encode([
            "sucesso" => false,
            "erro" => "Informe id_agendamento ou data_coleta com slot_ordem.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!$stmt->execute() || $stmt->affected_rows === 0) {
        $stmt->close();
        echo json_encode([
            "sucesso" => false,
            "erro" => "Agendamento nao encontrado.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->close();

    echo json_encode([
        "sucesso" => true,
        "mensagem" => "Agendamento cancelado.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(["sucesso" => false, "erro" => "Acao invalida."], JSON_UNESCAPED_UNICODE);
