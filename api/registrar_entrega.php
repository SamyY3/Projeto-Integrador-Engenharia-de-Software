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

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["sucesso" => false, "erro" => "Use POST."], JSON_UNESCAPED_UNICODE);
    exit;
}

$usuarioId = (int) $_SESSION["usuario_id"];
$acao = trim((string) ($_POST["acao"] ?? "registrar"));

if ($acao !== "registrar") {
    echo json_encode(["sucesso" => false, "erro" => "Acao invalida."], JSON_UNESCAPED_UNICODE);
    exit;
}

$idPev = (int) ($_POST["id_pev"] ?? 0);
$pontos = (int) ($_POST["pontos_gerados"] ?? 0);
$pesoInformado = isset($_POST["peso_total"]) && trim((string) $_POST["peso_total"]) !== "";
$peso = $pesoInformado ? (float) str_replace(",", ".", (string) $_POST["peso_total"]) : 0.0;

if ($pontos <= 0 && $peso !== null && $peso > 0) {
    $pontos = max(1, (int) round($peso * 10));
}

if ($pontos <= 0) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Informe pontos_gerados maior que zero.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$nomePonto = "EcoPonto";
if ($idPev > 0) {
    $stmtPev = $conn->prepare(
        "SELECT COALESCE(NULLIF(TRIM(nome_ponto), ''), 'EcoPonto') AS nome_ponto
         FROM ponto_entrega WHERE id_pev = ? LIMIT 1"
    );
    if ($stmtPev) {
        $stmtPev->bind_param("i", $idPev);
        if ($stmtPev->execute()) {
            $rowPev = ecocoleta_stmt_fetch_one_assoc($stmtPev);
            if (!$rowPev) {
                $stmtPev->close();
                echo json_encode([
                    "sucesso" => false,
                    "erro" => "Ponto de entrega invalido.",
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $nomePonto = (string) $rowPev["nome_ponto"];
        }
        $stmtPev->close();
    }
} else {
    $idPev = null;
}

$conn->begin_transaction();

try {
    if ($idPev !== null) {
        $stmt = $conn->prepare(
            "INSERT INTO entrega (peso_total, pontos_gerados, id_usuario, id_pev)
             VALUES (?, ?, ?, ?)"
        );
        if (!$stmt) {
            throw new Exception("Erro ao preparar registro de entrega.");
        }
        $stmt->bind_param("diii", $peso, $pontos, $usuarioId, $idPev);
    } else {
        $stmt = $conn->prepare(
            "INSERT INTO entrega (peso_total, pontos_gerados, id_usuario)
             VALUES (?, ?, ?)"
        );
        if (!$stmt) {
            throw new Exception("Erro ao preparar registro de entrega.");
        }
        $stmt->bind_param("dii", $peso, $pontos, $usuarioId);
    }

    if (!$stmt->execute()) {
        throw new Exception("Erro ao registrar entrega.");
    }
    $stmt->close();

    $idEntrega = (int) $conn->insert_id;

    if (ecocoleta_usuario_tem_coluna_saldo_ecopoints($conn)) {
        $novoSync = ecocoleta_obter_saldo_calculado_entrega_resgate($conn, $usuarioId);
        $stmtUp = $conn->prepare("UPDATE usuario SET saldo_ecopoints = ? WHERE id_usuario = ?");
        if ($stmtUp) {
            $stmtUp->bind_param("ii", $novoSync, $usuarioId);
            $stmtUp->execute();
            $stmtUp->close();
        }
    }

    $conn->commit();

    if ($idEntrega > 0) {
        ecocoleta_notif_entrega($conn, $usuarioId, $idEntrega, $pontos, $nomePonto);
    }

    echo json_encode([
        "sucesso" => true,
        "mensagem" => "Entrega registrada com sucesso.",
        "id_entrega" => $idEntrega,
        "pontos_gerados" => $pontos,
        "saldo_ecopoints" => ecocoleta_obter_saldo_usuario($conn, $usuarioId),
        "notificacao_criada" => $idEntrega > 0,
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode([
        "sucesso" => false,
        "erro" => "Nao foi possivel registrar a entrega.",
    ], JSON_UNESCAPED_UNICODE);
}
