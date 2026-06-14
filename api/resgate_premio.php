<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";

if (empty($_SESSION["usuario_id"]) || (int) $_SESSION["usuario_id"] <= 0) {
    echo json_encode(["sucesso" => false, "erro" => "Sessao expirada. Faca login novamente."], JSON_UNESCAPED_UNICODE);
    exit;
}

$usuario_id = (int) $_SESSION["usuario_id"];
$acao = trim((string) ($_POST["acao"] ?? ""));

if ($_SERVER["REQUEST_METHOD"] !== "POST" || $acao === "") {
    http_response_code(405);
    echo json_encode(["sucesso" => false, "erro" => "Use POST com o campo acao."], JSON_UNESCAPED_UNICODE);
    exit;
}

function listarIdsResgatados(mysqli $conn, $uid) {
    $stmt = $conn->prepare("SELECT id_beneficio FROM resgate WHERE id_usuario = ?");
    if (!$stmt) {
        return [];
    }
    $stmt->bind_param("i", $uid);
    if (!$stmt->execute()) {
        $stmt->close();
        return [];
    }
    $bid = 0;
    $stmt->bind_result($bid);
    $out = [];
    while ($stmt->fetch()) {
        $out[] = (int) $bid;
    }
    $stmt->close();
    return $out;
}

function ecocoleta_resgate_tabela_existe(mysqli $conn, string $tabela): bool {
    $tabela = preg_replace('/[^A-Za-z0-9_]/', '', $tabela);
    if ($tabela === '') {
        return false;
    }
    $res = @$conn->query("SHOW TABLES LIKE '{$tabela}'");
    if (!$res) {
        return false;
    }
    $ok = $res->num_rows > 0;
    $res->free();
    return $ok;
}

function ecocoleta_garantir_tabela_cupom_novo_usuario(mysqli $conn): void {
    @$conn->query(
        "CREATE TABLE IF NOT EXISTS cupom_novo_usuario_resgate (
            id_cupom_resgate INT AUTO_INCREMENT PRIMARY KEY,
            id_usuario INT NOT NULL,
            codigo_cupom VARCHAR(50) NOT NULL,
            data_resgate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_usuario_codigo_novo (id_usuario, codigo_cupom),
            KEY idx_cupom_novo_usuario (codigo_cupom, data_resgate),
            CONSTRAINT fk_cupom_novo_usuario_usuario
                FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function ecocoleta_usuario_tem_cupom_novo(mysqli $conn, int $uid, string $codigo): bool {
    if (!ecocoleta_resgate_tabela_existe($conn, "cupom_novo_usuario_resgate")) {
        return false;
    }
    $stmt = $conn->prepare(
        "SELECT id_cupom_resgate FROM cupom_novo_usuario_resgate
         WHERE id_usuario = ? AND codigo_cupom = ? LIMIT 1"
    );
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param("is", $uid, $codigo);
    $stmt->execute();
    $ok = ecocoleta_stmt_num_rows($stmt) > 0;
    $stmt->close();
    return $ok;
}

function ecocoleta_contar_linhas_usuario(mysqli $conn, string $tabela, string $colunaUsuario, int $uid): int {
    if (!ecocoleta_resgate_tabela_existe($conn, $tabela)) {
        return 0;
    }
    $tabela = preg_replace('/[^A-Za-z0-9_]/', '', $tabela);
    $colunaUsuario = preg_replace('/[^A-Za-z0-9_]/', '', $colunaUsuario);
    if ($tabela === '' || $colunaUsuario === '') {
        return 0;
    }
    $stmt = $conn->prepare("SELECT COUNT(*) AS total FROM {$tabela} WHERE {$colunaUsuario} = ?");
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("i", $uid);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    return (int) ($row["total"] ?? 0);
}

function ecocoleta_usuario_coluna_data_criacao(mysqli $conn): ?string {
    $cols = ["criado_em", "data_cadastro", "created_at", "dt_cadastro"];
    foreach ($cols as $col) {
        $safe = preg_replace('/[^A-Za-z0-9_]/', '', $col);
        $res = @$conn->query("SHOW COLUMNS FROM usuario LIKE '{$safe}'");
        if ($res && $res->num_rows > 0) {
            $res->free();
            return $safe;
        }
        if ($res) {
            $res->free();
        }
    }
    return null;
}

function ecocoleta_usuario_novo_elegivel(mysqli $conn, int $uid): array {
    $resgates = ecocoleta_contar_linhas_usuario($conn, "resgate", "id_usuario", $uid);
    $entregas = ecocoleta_contar_linhas_usuario($conn, "entrega", "id_usuario", $uid);
    $agendamentos = ecocoleta_contar_linhas_usuario($conn, "agendamento_coleta_morador", "id_usuario", $uid);

    if (($resgates + $entregas + $agendamentos) > 0) {
        return [
            "elegivel" => false,
            "motivo" => "Este cupom é exclusivo para novos usuários sem atividade anterior.",
        ];
    }

    $colData = ecocoleta_usuario_coluna_data_criacao($conn);
    if ($colData !== null) {
        $stmt = $conn->prepare("SELECT {$colData} AS criado_em FROM usuario WHERE id_usuario = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("i", $uid);
            $stmt->execute();
            $row = ecocoleta_stmt_fetch_one_assoc($stmt);
            $stmt->close();
            $ts = isset($row["criado_em"]) ? strtotime((string) $row["criado_em"]) : false;
            if ($ts !== false && $ts < strtotime("-30 days")) {
                return [
                    "elegivel" => false,
                    "motivo" => "Este cupom é válido apenas para contas novas.",
                ];
            }
        }
    }

    return ["elegivel" => true, "motivo" => ""];
}

function ecocoleta_estado_cupom_novo(mysqli $conn, int $uid, string $codigo): array {
    ecocoleta_garantir_tabela_cupom_novo_usuario($conn);
    $resgatado = ecocoleta_usuario_tem_cupom_novo($conn, $uid, $codigo);
    $elig = $resgatado
        ? ["elegivel" => false, "motivo" => "Cupom já resgatado nesta conta."]
        : ecocoleta_usuario_novo_elegivel($conn, $uid);

    return [
        "codigo_cupom" => $codigo,
        "resgatado" => $resgatado,
        "elegivel" => (bool) $elig["elegivel"],
        "motivo" => (string) $elig["motivo"],
    ];
}

$CUPOM_NOVO_USUARIO = "ECOSAVE20";

if ($acao === "verificar_cupom_novo_usuario") {
    $estado = ecocoleta_estado_cupom_novo($conn, $usuario_id, $CUPOM_NOVO_USUARIO);
    echo json_encode(array_merge(["sucesso" => true], $estado), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "resgatar_cupom_novo_usuario") {
    ecocoleta_garantir_tabela_cupom_novo_usuario($conn);
    $conn->begin_transaction();
    try {
        $stmtLock = $conn->prepare("SELECT id_usuario FROM usuario WHERE id_usuario = ? LIMIT 1 FOR UPDATE");
        if ($stmtLock) {
            $stmtLock->bind_param("i", $usuario_id);
            $stmtLock->execute();
            $stmtLock->close();
        }

        if (ecocoleta_usuario_tem_cupom_novo($conn, $usuario_id, $CUPOM_NOVO_USUARIO)) {
            $conn->rollback();
            echo json_encode([
                "sucesso" => false,
                "erro" => "Cupom já resgatado nesta conta.",
                "erro_codigo" => "cupom_ja_resgatado",
                "codigo_cupom" => $CUPOM_NOVO_USUARIO,
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $elig = ecocoleta_usuario_novo_elegivel($conn, $usuario_id);
        if (!$elig["elegivel"]) {
            $conn->rollback();
            echo json_encode([
                "sucesso" => false,
                "erro" => $elig["motivo"],
                "erro_codigo" => "cupom_usuario_nao_novo",
                "codigo_cupom" => $CUPOM_NOVO_USUARIO,
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmt = $conn->prepare(
            "INSERT INTO cupom_novo_usuario_resgate (id_usuario, codigo_cupom)
             VALUES (?, ?)"
        );
        if (!$stmt) {
            throw new Exception("Erro ao preparar resgate do cupom.");
        }
        $stmt->bind_param("is", $usuario_id, $CUPOM_NOVO_USUARIO);
        if (!$stmt->execute()) {
            if ((int) $conn->errno === 1062) {
                $conn->rollback();
                echo json_encode([
                    "sucesso" => false,
                    "erro" => "Cupom já resgatado nesta conta.",
                    "erro_codigo" => "cupom_ja_resgatado",
                    "codigo_cupom" => $CUPOM_NOVO_USUARIO,
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            throw new Exception("Erro ao registrar resgate do cupom.");
        }
        $stmt->close();
        $conn->commit();

        echo json_encode([
            "sucesso" => true,
            "mensagem" => "Cupom resgatado com sucesso.",
            "codigo_cupom" => $CUPOM_NOVO_USUARIO,
            "resgatado" => true,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Throwable $e) {
        $conn->rollback();
        echo json_encode([
            "sucesso" => false,
            "erro" => $e->getMessage() !== "" ? $e->getMessage() : "Não foi possível resgatar o cupom.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($acao === "verificar_resgates") {
    $resgates = listarIdsResgatados($conn, $usuario_id);
    $saldo = ecocoleta_obter_saldo_usuario($conn, $usuario_id);
    echo json_encode([
        "sucesso" => true,
        "resgates" => $resgates,
        "saldo_ecopoints" => $saldo,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "listar_historico") {
    $sql = "SELECT r.id_resgate,
                   r.data_resgate,
                   r.pontos_utilizados AS pontos_gastos,
                   r.id_beneficio,
                   COALESCE(NULLIF(TRIM(b.nome_beneficio), ''), CONCAT('Prêmio #', r.id_beneficio)) AS nome_premio,
                   COALESCE(NULLIF(TRIM(b.codigo_cupom), ''), CONCAT('CODIGO-', r.id_beneficio)) AS codigo_cupom
            FROM resgate r
            LEFT JOIN beneficio b ON b.id_beneficio = r.id_beneficio
            WHERE r.id_usuario = ?
            ORDER BY r.data_resgate DESC, r.id_resgate DESC";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao preparar historico de resgates."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt->bind_param("i", $usuario_id);
    if (!$stmt->execute()) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao carregar historico."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $allRows = ecocoleta_stmt_fetch_all_assoc($stmt);
    $stmt->close();

    $historico = [];
    foreach ($allRows as $row) {
        $ts = $row["data_resgate"] ?? null;
        $iso = null;
        if ($ts !== null && $ts !== "") {
            $t = strtotime((string) $ts);
            if ($t !== false) {
                $iso = date("c", $t);
            }
        }
        $historico[] = [
            "id_resgate" => (int) $row["id_resgate"],
            "id_beneficio" => (int) $row["id_beneficio"],
            "nome_premio" => (string) $row["nome_premio"],
            "pontos_gastos" => (int) $row["pontos_gastos"],
            "codigo_cupom" => (string) $row["codigo_cupom"],
            "data_resgate" => $iso,
        ];
    }

    echo json_encode([
        "sucesso" => true,
        "historico" => $historico,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($acao === "resgatar") {
    $id_beneficio = (int) ($_POST["id_beneficio"] ?? 0);
    if ($id_beneficio <= 0) {
        echo json_encode(["sucesso" => false, "erro" => "Premio invalido."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $conn->begin_transaction();
    try {
        $stmtB = $conn->prepare(
            "SELECT id_beneficio, nome_beneficio, pontos_necessarios, COALESCE(codigo_cupom, '') AS codigo_cupom
             FROM beneficio WHERE id_beneficio = ? LIMIT 1 FOR UPDATE"
        );
        if (!$stmtB) {
            throw new Exception("Erro ao preparar consulta do premio.");
        }
        $stmtB->bind_param("i", $id_beneficio);
        if (!$stmtB->execute()) {
            throw new Exception("Erro ao consultar premio.");
        }
        $benef = ecocoleta_stmt_fetch_one_assoc($stmtB);
        $stmtB->close();
        if (!$benef) {
            $conn->rollback();
            echo json_encode(["sucesso" => false, "erro" => "Premio nao encontrado no sistema."], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $pontos = (int) $benef["pontos_necessarios"];
        if ($pontos <= 0) {
            $conn->rollback();
            echo json_encode(["sucesso" => false, "erro" => "Premio com pontos invalidos."], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmtExiste = $conn->prepare(
            "SELECT id_resgate FROM resgate WHERE id_usuario = ? AND id_beneficio = ? LIMIT 1 FOR UPDATE"
        );
        if (!$stmtExiste) {
            throw new Exception("Erro ao preparar verificacao de resgate.");
        }
        $stmtExiste->bind_param("ii", $usuario_id, $id_beneficio);
        $stmtExiste->execute();
        $jaResgatou = ecocoleta_stmt_num_rows($stmtExiste) > 0;
        $stmtExiste->close();
        if ($jaResgatou) {
            $conn->rollback();
            echo json_encode(["sucesso" => false, "erro" => "Premio ja resgatado."], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmtU = $conn->prepare("SELECT id_usuario FROM usuario WHERE id_usuario = ? LIMIT 1 FOR UPDATE");
        if ($stmtU) {
            $stmtU->bind_param("i", $usuario_id);
            $stmtU->execute();
            $stmtU->close();
        }

        $saldo = ecocoleta_obter_saldo_usuario($conn, $usuario_id);
        if ($saldo < $pontos) {
            $conn->rollback();
            echo json_encode([
                "sucesso" => false,
                "erro" => "Você não possui pontos suficientes para resgatar este prêmio.",
                "erro_codigo" => "pontos_insuficientes",
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmtIns = $conn->prepare("INSERT INTO resgate (pontos_utilizados, id_usuario, id_beneficio) VALUES (?, ?, ?)");
        if (!$stmtIns) {
            throw new Exception("Erro ao preparar registro de resgate.");
        }
        $stmtIns->bind_param("iii", $pontos, $usuario_id, $id_beneficio);
        if (!$stmtIns->execute()) {
            if ((int) $conn->errno === 1062) {
                $conn->rollback();
                echo json_encode(["sucesso" => false, "erro" => "Premio ja resgatado."], JSON_UNESCAPED_UNICODE);
                exit;
            }
            throw new Exception("Erro ao registrar resgate.");
        }
        $stmtIns->close();

        if (ecocoleta_usuario_tem_coluna_saldo_ecopoints($conn)) {
            $novoSync = ecocoleta_obter_saldo_calculado_entrega_resgate($conn, $usuario_id);
            $stmtUp = $conn->prepare("UPDATE usuario SET saldo_ecopoints = ? WHERE id_usuario = ?");
            if ($stmtUp) {
                $stmtUp->bind_param("ii", $novoSync, $usuario_id);
                if (!$stmtUp->execute() || $stmtUp->affected_rows === 0) {
                    $stmtUp->close();
                    throw new Exception("Falha ao atualizar saldo. Tente novamente.");
                }
                $stmtUp->close();
            }
        }

        $idResgate = (int) $conn->insert_id;
        $conn->commit();

        require_once dirname(__DIR__) . "/includes/notificacoes_helper.php";
        if ($idResgate > 0) {
            ecocoleta_notif_resgate(
                $conn,
                $usuario_id,
                $idResgate,
                (string) $benef["nome_beneficio"],
                $pontos
            );
        }

        $novo_saldo = ecocoleta_obter_saldo_usuario($conn, $usuario_id);
        $cupom = trim((string) $benef["codigo_cupom"]);
        if ($cupom === "") {
            $cupom = "CODIGO-" . $id_beneficio;
        }

        echo json_encode([
            "sucesso" => true,
            "mensagem" => "Premio resgatado com sucesso.",
            "id_beneficio" => $id_beneficio,
            "pontos_utilizados" => $pontos,
            "cupom_codigo" => $cupom,
            "saldo_ecopoints" => $novo_saldo,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Throwable $e) {
        $conn->rollback();
        echo json_encode([
            "sucesso" => false,
            "erro" => $e->getMessage() !== "" ? $e->getMessage() : "Nao foi possivel concluir o resgate.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

echo json_encode(["sucesso" => false, "erro" => "Acao invalida."], JSON_UNESCAPED_UNICODE);
