<?php

declare(strict_types=1);

require_once __DIR__ . "/stmt_helpers.php";
require_once __DIR__ . "/conexao.php";

const ECORANK_BONUS_PONTOS = 100;

const ECORANK_RUAS_SEED = [
    ["rua" => "Rua São Pedro", "bairro" => "Centro", "pontos" => 3500, "kg" => 180],
    ["rua" => "Rua Padre Cícero", "bairro" => "Triângulo", "pontos" => 3200, "kg" => 165],
    ["rua" => "Rua Santa Luzia", "bairro" => "Pirajá", "pontos" => 2900, "kg" => 150],
    ["rua" => "Rua do Seminário", "bairro" => "Seminário", "pontos" => 2600, "kg" => 140],
    ["rua" => "Rua São José", "bairro" => "Centro", "pontos" => 2300, "kg" => 120],
    ["rua" => "Rua N. Sra das Dores", "bairro" => "Santa Rosa", "pontos" => 2100, "kg" => 110],
    ["rua" => "Rua Leão XIII", "bairro" => "Lagoa Seca", "pontos" => 1900, "kg" => 98],
    ["rua" => "Rua Dep. Golveia", "bairro" => "Belavista", "pontos" => 1700, "kg" => 85],
    ["rua" => "Rua José Marrocos", "bairro" => "Parque da Cidade", "pontos" => 1500, "kg" => 70],
    ["rua" => "Rua Santa Isabel", "bairro" => "Rio Baixo", "pontos" => 1300, "kg" => 60],
];

function ecorank_intervalo(string $periodo = "semana"): array
{
    $hoje = new DateTimeImmutable("today");

    if ($periodo === "mes") {
        return [
            "desde" => $hoje->modify("first day of this month")->format("Y-m-d"),
            "ate" => $hoje->format("Y-m-d"),
            "rotulo" => "mensal",
        ];
    }

    $diaSemana = (int) $hoje->format("N");
    $segunda = $hoje->modify("-" . ($diaSemana - 1) . " days");

    return [
        "desde" => $segunda->format("Y-m-d"),
        "ate" => $hoje->format("Y-m-d"),
        "rotulo" => "semanal",
    ];
}

function ecorank_formatar_pontos(int $pontos): string
{
    return number_format($pontos, 0, ",", ".");
}

function ecorank_formatar_kg(float $kg, bool $comSufixo = false): string
{
    if ($kg >= 1000) {
        $t = round($kg / 1000, 1);
        $txt = number_format($t, $t == floor($t) ? 0 : 1, ",", ".") . " ton";
        return $comSufixo ? $txt . " reciclados" : $txt;
    }
    $n = (int) round($kg);
    return $comSufixo ? $n . " kg reciclados" : (string) $n;
}

function ecorank_formatar_kg_card(float $kg): string
{
    if ($kg >= 10000) {
        $t = round($kg / 1000, 1);
        return number_format($t, $t == floor($t) ? 0 : 1, ",", ".") . "t";
    }
    if ($kg >= 100) {
        return number_format((int) round($kg), 0, ",", ".") . "Kg";
    }
    if ($kg > 0 && $kg < 1) {
        return number_format($kg, 1, ",", ".") . "Kg";
    }
    return number_format((int) round($kg), 0, ",", ".") . "Kg";
}

function ecorank_garantir_bairro(mysqli $conn, string $nome): int
{
    $nome = trim($nome);
    if ($nome === "") {
        return 0;
    }
    $stmt = $conn->prepare("SELECT id_bairro FROM bairro WHERE nome_bairro = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("s", $nome);
        if ($stmt->execute()) {
            $row = ecocoleta_stmt_fetch_one_assoc($stmt);
            $stmt->close();
            if ($row) {
                return (int) $row["id_bairro"];
            }
        } else {
            $stmt->close();
        }
    }
    $ins = $conn->prepare("INSERT INTO bairro (nome_bairro) VALUES (?)");
    if (!$ins) {
        return 0;
    }
    $ins->bind_param("s", $nome);
    if (!$ins->execute()) {
        $ins->close();
        return 0;
    }
    $id = (int) $conn->insert_id;
    $ins->close();
    return $id;
}

function ecorank_garantir_rua(mysqli $conn, string $nomeRua, string $nomeBairro): int
{
    $nomeRua = trim($nomeRua);
    if ($nomeRua === "") {
        return 0;
    }
    $idBairro = ecorank_garantir_bairro($conn, $nomeBairro);

    $stmt = $conn->prepare(
        "SELECT id_rua FROM rua WHERE nome_rua = ? AND (id_bairro = ? OR (? = 0 AND id_bairro IS NULL)) LIMIT 1"
    );
    if ($stmt) {
        $stmt->bind_param("sii", $nomeRua, $idBairro, $idBairro);
        if ($stmt->execute()) {
            $row = ecocoleta_stmt_fetch_one_assoc($stmt);
            $stmt->close();
            if ($row) {
                return (int) $row["id_rua"];
            }
        } else {
            $stmt->close();
        }
    }

    if ($idBairro > 0) {
        $ins = $conn->prepare("INSERT INTO rua (nome_rua, id_bairro) VALUES (?, ?)");
        if ($ins) {
            $ins->bind_param("si", $nomeRua, $idBairro);
            if ($ins->execute()) {
                $id = (int) $conn->insert_id;
                $ins->close();
                return $id;
            }
            $ins->close();
        }
    }

    $ins2 = $conn->prepare("INSERT INTO rua (nome_rua, id_bairro) VALUES (?, NULL)");
    if (!$ins2) {
        return 0;
    }
    $ins2->bind_param("s", $nomeRua);
    if (!$ins2->execute()) {
        $ins2->close();
        return 0;
    }
    $id = (int) $conn->insert_id;
    $ins2->close();
    return $id;
}

function ecorank_contar_entregas_periodo(mysqli $conn, string $desde, string $ate): int
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return 0;
    }
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS c FROM entrega WHERE DATE(data_entrega) >= ? AND DATE(data_entrega) <= ?"
    );
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("ss", $desde, $ate);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    return (int) ($row["c"] ?? 0);
}

function ecorank_listar_ids_usuario(mysqli $conn): array
{
    $ids = [];
    $res = @$conn->query(
        "SELECT id_usuario FROM usuario WHERE tipo_usuario = 'morador' ORDER BY id_usuario ASC LIMIT 80"
    );
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $ids[] = (int) $row["id_usuario"];
        }
        $res->free();
    }
    return $ids;
}

function ecorank_garantir_usuario_rua(mysqli $conn, int $idRua): int
{
    if ($idRua <= 0) {
        return 0;
    }
    $stmt = $conn->prepare("SELECT id_usuario FROM usuario WHERE id_rua = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("i", $idRua);
        if ($stmt->execute()) {
            $row = ecocoleta_stmt_fetch_one_assoc($stmt);
            $stmt->close();
            if ($row) {
                return (int) $row["id_usuario"];
            }
        } else {
            $stmt->close();
        }
    }

    $email = "ranking.rua." . $idRua . "@seed.ecocoleta.local";
    $stmtE = $conn->prepare("SELECT id_usuario FROM usuario WHERE email = ? LIMIT 1");
    if ($stmtE) {
        $stmtE->bind_param("s", $email);
        if ($stmtE->execute()) {
            $row = ecocoleta_stmt_fetch_one_assoc($stmtE);
            $stmtE->close();
            if ($row) {
                $uid = (int) $row["id_usuario"];
                $up = $conn->prepare("UPDATE usuario SET id_rua = ? WHERE id_usuario = ? LIMIT 1");
                if ($up) {
                    $up->bind_param("ii", $idRua, $uid);
                    $up->execute();
                    $up->close();
                }
                return $uid;
            }
        } else {
            $stmtE->close();
        }
    }

    $hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
    $nome = "Morador Rua " . $idRua;
    $ins = $conn->prepare(
        "INSERT INTO usuario (nome, email, senha_hash, tipo_usuario, id_rua) VALUES (?, ?, ?, 'morador', ?)"
    );
    if (!$ins) {
        return 0;
    }
    $ins->bind_param("sssi", $nome, $email, $hash, $idRua);
    if (!$ins->execute()) {
        $ins->close();
        return 0;
    }
    $uid = (int) $conn->insert_id;
    $ins->close();
    return $uid;
}

function ecorank_garantir_schema(mysqli $conn): bool
{
    static $ok = null;
    if ($ok === true) {
        return true;
    }

    $sqls = [
        "CREATE TABLE IF NOT EXISTS ranking_semana_snapshot (
            id_snapshot INT AUTO_INCREMENT PRIMARY KEY,
            semana_inicio DATE NOT NULL,
            semana_fim DATE NOT NULL,
            id_rua_vencedora INT NOT NULL,
            nome_rua VARCHAR(120) NOT NULL DEFAULT '',
            nome_bairro VARCHAR(120) NOT NULL DEFAULT '',
            pontos_totais INT NOT NULL DEFAULT 0,
            kg_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
            bonificacao_processada TINYINT(1) NOT NULL DEFAULT 0,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_ranking_semana_inicio (semana_inicio),
            KEY idx_ranking_snapshot_rua (id_rua_vencedora)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS ranking_bonificacao_usuario (
            id_bonificacao INT AUTO_INCREMENT PRIMARY KEY,
            semana_inicio DATE NOT NULL,
            id_usuario INT NOT NULL,
            id_rua INT NOT NULL,
            pontos_bonus INT NOT NULL DEFAULT 100,
            id_entrega_bonus INT NULL DEFAULT NULL,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_ranking_bonus_semana_usuario (semana_inicio, id_usuario),
            KEY idx_ranking_bonus_usuario (id_usuario)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS ranking_controle (
            chave VARCHAR(64) NOT NULL PRIMARY KEY,
            valor VARCHAR(255) NOT NULL,
            atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS ranking_card_publico (
            semana_inicio DATE NOT NULL PRIMARY KEY,
            semana_fim DATE NOT NULL,
            total_kg DECIMAL(12, 2) NOT NULL DEFAULT 0,
            total_pontos INT NOT NULL DEFAULT 0,
            total_ruas INT NOT NULL DEFAULT 0,
            atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS ranking_card_usuario (
            id_card INT AUTO_INCREMENT PRIMARY KEY,
            semana_inicio DATE NOT NULL,
            id_usuario INT NOT NULL,
            id_rua INT NOT NULL DEFAULT 0,
            nome_rua VARCHAR(120) NOT NULL DEFAULT '',
            kg_pessoal DECIMAL(10, 2) NOT NULL DEFAULT 0,
            kg_rua_semana DECIMAL(10, 2) NOT NULL DEFAULT 0,
            pontos_rua_semana INT NOT NULL DEFAULT 0,
            posicao_rua INT NOT NULL DEFAULT 0,
            total_ruas_ranking INT NOT NULL DEFAULT 0,
            kg_meta_mensal DECIMAL(10, 2) NOT NULL DEFAULT 1200,
            kg_mes_atual DECIMAL(10, 2) NOT NULL DEFAULT 0,
            percentual_meta INT NOT NULL DEFAULT 0,
            atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_ranking_card_usuario_semana (semana_inicio, id_usuario),
            KEY idx_ranking_card_usuario (id_usuario)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ];

    foreach ($sqls as $sql) {
        if (!@$conn->query($sql)) {
            return false;
        }
    }

    $ok = true;
    return true;
}

function ecorank_entrega_tem_coluna(mysqli $conn, string $coluna): bool
{
    static $cache = [];
    if (array_key_exists($coluna, $cache)) {
        return $cache[$coluna];
    }
    $q = $conn->query("SHOW COLUMNS FROM entrega LIKE '" . $conn->real_escape_string($coluna) . "'");
    $cache[$coluna] = ($q && $q->num_rows > 0);
    if ($q) {
        $q->free();
    }
    return $cache[$coluna];
}

function ecorank_primeiro_pev(mysqli $conn): int
{
    $res = @$conn->query("SELECT id_pev FROM ponto_entrega ORDER BY id_pev ASC LIMIT 1");
    if ($res && ($row = $res->fetch_assoc())) {
        $id = (int) $row["id_pev"];
        $res->free();
        return $id;
    }
    return 0;
}

function ecorank_sincronizar_saldo_usuario(mysqli $conn, int $idUsuario): void
{
    if ($idUsuario <= 0 || !ecocoleta_usuario_tem_coluna_saldo_ecopoints($conn)) {
        return;
    }
    $novo = ecocoleta_obter_saldo_calculado_entrega_resgate($conn, $idUsuario);
    $stmt = $conn->prepare("UPDATE usuario SET saldo_ecopoints = ? WHERE id_usuario = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("ii", $novo, $idUsuario);
        $stmt->execute();
        $stmt->close();
    }
}

function ecorank_intervalo_semana_fechada(string $segundaInicio): array
{
    $segunda = new DateTimeImmutable($segundaInicio);
    return [
        "desde" => $segunda->format("Y-m-d"),
        "ate" => $segunda->modify("+6 days")->format("Y-m-d"),
    ];
}

function ecorank_obter_snapshot_semana(mysqli $conn, string $semanaInicio): ?array
{
    if (!ecocoleta_tabela_existe($conn, "ranking_semana_snapshot")) {
        return null;
    }
    $stmt = $conn->prepare(
        "SELECT semana_inicio, semana_fim, id_rua_vencedora, nome_rua, nome_bairro,
                pontos_totais, kg_total, bonificacao_processada
         FROM ranking_semana_snapshot WHERE semana_inicio = ? LIMIT 1"
    );
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param("s", $semanaInicio);
    if (!$stmt->execute()) {
        $stmt->close();
        return null;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    if (!$row) {
        return null;
    }
    return [
        "semana_inicio" => (string) $row["semana_inicio"],
        "semana_fim" => (string) $row["semana_fim"],
        "id_rua" => (int) $row["id_rua_vencedora"],
        "nome_rua" => (string) $row["nome_rua"],
        "nome_bairro" => (string) $row["nome_bairro"],
        "pontos" => (int) $row["pontos_totais"],
        "pontos_fmt" => ecorank_formatar_pontos((int) $row["pontos_totais"]),
        "kg" => (float) $row["kg_total"],
        "kg_fmt" => ecorank_formatar_kg((float) $row["kg_total"], true),
        "bonificacao_processada" => (int) $row["bonificacao_processada"] === 1,
    ];
}

function ecorank_inserir_entrega_bonus(
    mysqli $conn,
    int $idUsuario,
    int $pontos,
    string $dataEntrega
): int {
    if ($idUsuario <= 0 || $pontos <= 0 || !ecocoleta_tabela_existe($conn, "entrega")) {
        return 0;
    }

    $idPev = ecorank_primeiro_pev($conn);
    $peso = 0.0;
    $temResp = ecorank_entrega_tem_coluna($conn, "responsavel");
    $resp = "ranking_semana";
    $idEntrega = 0;

    if ($idPev > 0 && $temResp) {
        $stmt = $conn->prepare(
            "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario, id_pev, responsavel)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        if ($stmt) {
            $stmt->bind_param("sdiiis", $dataEntrega, $peso, $pontos, $idUsuario, $idPev, $resp);
            if ($stmt->execute()) {
                $idEntrega = (int) $conn->insert_id;
            }
            $stmt->close();
        }
    } elseif ($idPev > 0) {
        $stmt = $conn->prepare(
            "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario, id_pev)
             VALUES (?, ?, ?, ?, ?)"
        );
        if ($stmt) {
            $stmt->bind_param("sdiii", $dataEntrega, $peso, $pontos, $idUsuario, $idPev);
            if ($stmt->execute()) {
                $idEntrega = (int) $conn->insert_id;
            }
            $stmt->close();
        }
    } else {
        $stmt = $conn->prepare(
            "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario)
             VALUES (?, ?, ?, ?)"
        );
        if ($stmt) {
            $stmt->bind_param("sdii", $dataEntrega, $peso, $pontos, $idUsuario);
            if ($stmt->execute()) {
                $idEntrega = (int) $conn->insert_id;
            }
            $stmt->close();
        }
    }

    if ($idEntrega > 0) {
        ecorank_sincronizar_saldo_usuario($conn, $idUsuario);
    }

    return $idEntrega;
}

function ecorank_notificar_bonus_ranking(
    mysqli $conn,
    int $idUsuario,
    string $nomeRua,
    string $semanaInicio,
    int $pontos
): void {
    $helper = __DIR__ . "/notificacoes_helper.php";
    if (!is_file($helper)) {
        return;
    }
    require_once $helper;
    if (!function_exists("ecocoleta_notif_inserir")) {
        return;
    }

    $refId = (int) str_replace("-", "", $semanaInicio);
    $titulo = "Sua rua liderou o ranking!";
    $msg = "Parabéns! A rua " . $nomeRua . " foi campeã da semana e você ganhou "
        . $pontos . " EcoPoints para trocar por cupons.";
    ecocoleta_notif_inserir(
        $conn,
        $idUsuario,
        "premio",
        "alta",
        $titulo,
        $msg,
        "🏆",
        "+" . $pontos . " pts",
        "ranking_semana",
        $refId
    );
}

function ecorank_creditar_bonus_rua(
    mysqli $conn,
    string $semanaInicio,
    int $idRua,
    string $nomeRua
): int {
    if ($idRua <= 0 || !ecocoleta_tabela_existe($conn, "ranking_bonificacao_usuario")) {
        return 0;
    }

    $intervalo = ecorank_intervalo_semana_fechada($semanaInicio);
    $dataBonus = $intervalo["ate"] . " 18:00:00";
    $pontos = ECORANK_BONUS_PONTOS;
    $creditados = 0;

    $stmt = $conn->prepare(
        "SELECT id_usuario FROM usuario
         WHERE id_rua = ? AND tipo_usuario = 'morador'"
    );
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("i", $idRua);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }

    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $uid = (int) ($row["id_usuario"] ?? 0);
        if ($uid <= 0) {
            continue;
        }

        $chk = $conn->prepare(
            "SELECT id_bonificacao FROM ranking_bonificacao_usuario
             WHERE semana_inicio = ? AND id_usuario = ? LIMIT 1"
        );
        if ($chk) {
            $chk->bind_param("si", $semanaInicio, $uid);
            $chk->execute();
            if (ecocoleta_stmt_num_rows($chk) > 0) {
                $chk->close();
                continue;
            }
            $chk->close();
        }

        $idEntrega = ecorank_inserir_entrega_bonus($conn, $uid, $pontos, $dataBonus);
        $ins = $conn->prepare(
            "INSERT INTO ranking_bonificacao_usuario
                (semana_inicio, id_usuario, id_rua, pontos_bonus, id_entrega_bonus)
             VALUES (?, ?, ?, ?, ?)"
        );
        if (!$ins) {
            continue;
        }
        $ins->bind_param("siiii", $semanaInicio, $uid, $idRua, $pontos, $idEntrega);
        if ($ins->execute()) {
            $creditados++;
            ecorank_notificar_bonus_ranking($conn, $uid, $nomeRua, $semanaInicio, $pontos);
        }
        $ins->close();
    }
    $stmt->close();

    return $creditados;
}

function ecorank_processar_semana_encerrada(mysqli $conn, string $semanaInicio): bool
{
    $intervalo = ecorank_intervalo_semana_fechada($semanaInicio);
    $semanaFim = $intervalo["ate"];

    $existente = ecorank_obter_snapshot_semana($conn, $semanaInicio);
    if ($existente && !empty($existente["bonificacao_processada"])) {
        return true;
    }

    $lista = ecorank_agregar_ruas($conn, $intervalo["desde"], $intervalo["ate"]);
    if ($lista === []) {
        if (ecorank_contar_entregas_periodo($conn, $intervalo["desde"], $intervalo["ate"]) === 0) {
            ecorank_seed_periodo($conn, $intervalo["desde"], $intervalo["ate"]);
            $lista = ecorank_agregar_ruas($conn, $intervalo["desde"], $intervalo["ate"]);
        }
        if ($lista === []) {
            return false;
        }
    }

    $vencedor = $lista[0];
    $idRua = (int) ($vencedor["id_rua"] ?? 0);
    $nomeRua = (string) ($vencedor["nome_rua"] ?? "");
    $nomeBairro = (string) ($vencedor["nome_bairro"] ?? "");
    $pontos = (int) ($vencedor["pontos"] ?? 0);
    $kg = (float) ($vencedor["kg"] ?? 0);

    if ($existente) {
        $stmt = $conn->prepare(
            "UPDATE ranking_semana_snapshot
             SET semana_fim = ?, id_rua_vencedora = ?, nome_rua = ?, nome_bairro = ?,
                 pontos_totais = ?, kg_total = ?
             WHERE semana_inicio = ? LIMIT 1"
        );
        if ($stmt) {
            $stmt->bind_param("sissids", $semanaFim, $idRua, $nomeRua, $nomeBairro, $pontos, $kg, $semanaInicio);
            $stmt->execute();
            $stmt->close();
        }
    } else {
        $stmt = $conn->prepare(
            "INSERT INTO ranking_semana_snapshot
                (semana_inicio, semana_fim, id_rua_vencedora, nome_rua, nome_bairro, pontos_totais, kg_total)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        if ($stmt) {
            $stmt->bind_param("ssissid", $semanaInicio, $semanaFim, $idRua, $nomeRua, $nomeBairro, $pontos, $kg);
            $stmt->execute();
            $stmt->close();
        }
    }

    ecorank_creditar_bonus_rua($conn, $semanaInicio, $idRua, $nomeRua);

    $up = $conn->prepare(
        "UPDATE ranking_semana_snapshot SET bonificacao_processada = 1 WHERE semana_inicio = ? LIMIT 1"
    );
    if ($up) {
        $up->bind_param("s", $semanaInicio);
        $up->execute();
        $up->close();
    }

    $ctrl = $conn->prepare(
        "INSERT INTO ranking_controle (chave, valor) VALUES ('ultima_semana_processada', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor), atualizado_em = CURRENT_TIMESTAMP"
    );
    if ($ctrl) {
        $ctrl->bind_param("s", $semanaInicio);
        $ctrl->execute();
        $ctrl->close();
    }

    return true;
}

function ecorank_listar_semanas_a_processar(mysqli $conn): array
{
    $segundaAtual = new DateTimeImmutable(ecorank_intervalo("semana")["desde"]);
    $ultimaCompleta = $segundaAtual->modify("-7 days");

    $ultimaSnapshot = "";
    $res = @$conn->query("SELECT COALESCE(MAX(semana_inicio), '') AS ult FROM ranking_semana_snapshot");
    if ($res && ($row = $res->fetch_assoc())) {
        $ultimaSnapshot = (string) ($row["ult"] ?? "");
        $res->free();
    }

    if ($ultimaSnapshot === "") {
        return [$ultimaCompleta->format("Y-m-d")];
    }

    $cursor = (new DateTimeImmutable($ultimaSnapshot))->modify("+7 days");
    $semanas = [];
    while ($cursor <= $ultimaCompleta) {
        $semanas[] = $cursor->format("Y-m-d");
        $cursor = $cursor->modify("+7 days");
    }
    return $semanas;
}

function ecorank_processar_rotacao_semanal(mysqli $conn, int $idUsuario = 0): array
{
    $resultado = [
        "bonificacao_recebida" => null,
        "vencedor_semana_anterior" => null,
    ];

    if (!ecorank_garantir_schema($conn)) {
        return $resultado;
    }

    foreach (ecorank_listar_semanas_a_processar($conn) as $semanaInicio) {
        ecorank_processar_semana_encerrada($conn, $semanaInicio);
    }

    $segundaAtual = new DateTimeImmutable(ecorank_intervalo("semana")["desde"]);
    $semanaAnterior = $segundaAtual->modify("-7 days")->format("Y-m-d");
    $resultado["vencedor_semana_anterior"] = ecorank_obter_snapshot_semana($conn, $semanaAnterior);

    if ($idUsuario > 0 && ecocoleta_tabela_existe($conn, "ranking_bonificacao_usuario")) {
        $stmt = $conn->prepare(
            "SELECT b.semana_inicio, b.pontos_bonus, b.id_rua, r.nome_rua
             FROM ranking_bonificacao_usuario b
             LEFT JOIN rua r ON r.id_rua = b.id_rua
             WHERE b.id_usuario = ?
             ORDER BY b.semana_inicio DESC LIMIT 1"
        );
        if ($stmt) {
            $stmt->bind_param("i", $idUsuario);
            if ($stmt->execute()) {
                $row = ecocoleta_stmt_fetch_one_assoc($stmt);
                if ($row) {
                    $resultado["bonificacao_recebida"] = [
                        "semana_inicio" => (string) $row["semana_inicio"],
                        "pontos" => (int) $row["pontos_bonus"],
                        "id_rua" => (int) $row["id_rua"],
                        "nome_rua" => (string) ($row["nome_rua"] ?? ""),
                        "recente" => ((string) $row["semana_inicio"]) === $semanaAnterior,
                    ];
                }
            }
            $stmt->close();
        }
    }

    return $resultado;
}

function ecorank_garantir_dados_periodo(mysqli $conn, string $desde, string $ate): void
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return;
    }

    if (ecorank_contar_entregas_periodo($conn, $desde, $ate) === 0) {
        ecorank_seed_periodo($conn, $desde, $ate);
        return;
    }

    $lista = ecorank_agregar_ruas($conn, $desde, $ate);
    if (count($lista) >= 3) {
        return;
    }

    ecorank_seed_complementar($conn, $desde, $ate);
}

function ecorank_seed_complementar(mysqli $conn, string $desde, string $ate): void
{
    $existentes = [];
    foreach (ecorank_agregar_ruas($conn, $desde, $ate) as $item) {
        $id = (int) ($item["id_rua"] ?? 0);
        if ($id > 0) {
            $existentes[$id] = true;
        }
    }

    $usuarios = ecorank_listar_ids_usuario($conn);
    $idPev = ecorank_primeiro_pev($conn);
    $dia = 0;

    foreach (ECORANK_RUAS_SEED as $item) {
        if (count($existentes) >= 10) {
            break;
        }

        $idRua = ecorank_garantir_rua($conn, $item["rua"], $item["bairro"]);
        if ($idRua <= 0 || isset($existentes[$idRua])) {
            continue;
        }

        $uid = ecorank_garantir_usuario_rua($conn, $idRua);
        if ($uid <= 0 && $usuarios !== []) {
            $uid = $usuarios[$dia % count($usuarios)];
            $up = $conn->prepare("UPDATE usuario SET id_rua = ? WHERE id_usuario = ? LIMIT 1");
            if ($up) {
                $up->bind_param("ii", $idRua, $uid);
                $up->execute();
                $up->close();
            }
        }
        if ($uid <= 0) {
            continue;
        }

        $pontos = (int) round((int) $item["pontos"] * 0.35);
        $kg = round((float) $item["kg"] * 0.35, 1);
        if ($pontos < 50) {
            $pontos = 50;
        }
        if ($kg < 5) {
            $kg = 5.0;
        }

        $offsetDias = min($dia, max(0, (int) ((strtotime($ate) - strtotime($desde)) / 86400)));
        $data = date("Y-m-d H:i:s", strtotime($desde . " +" . $offsetDias . " days 14:30:00"));

        if ($idPev > 0) {
            $stmt = $conn->prepare(
                "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario, id_pev)
                 VALUES (?, ?, ?, ?, ?)"
            );
            if ($stmt) {
                $stmt->bind_param("sdiii", $data, $kg, $pontos, $uid, $idPev);
                $stmt->execute();
                $stmt->close();
            }
        } else {
            $stmt = $conn->prepare(
                "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario)
                 VALUES (?, ?, ?, ?)"
            );
            if ($stmt) {
                $stmt->bind_param("sdii", $data, $kg, $pontos, $uid);
                $stmt->execute();
                $stmt->close();
            }
        }
        ecorank_sincronizar_saldo_usuario($conn, $uid);

        $existentes[$idRua] = true;
        $dia++;
    }
}

function ecorank_seed_periodo(mysqli $conn, string $desde, string $ate): void
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return;
    }
    if (ecorank_contar_entregas_periodo($conn, $desde, $ate) > 0) {
        return;
    }

    $usuarios = ecorank_listar_ids_usuario($conn);
    $idPev = 0;
    $resP = @$conn->query("SELECT id_pev FROM ponto_entrega ORDER BY id_pev ASC LIMIT 1");
    if ($resP && ($row = $resP->fetch_assoc())) {
        $idPev = (int) $row["id_pev"];
        $resP->free();
    }

    $dia = 0;
    foreach (ECORANK_RUAS_SEED as $item) {
        $idRua = ecorank_garantir_rua($conn, $item["rua"], $item["bairro"]);
        if ($idRua <= 0) {
            continue;
        }
        $uid = ecorank_garantir_usuario_rua($conn, $idRua);
        if ($uid <= 0 && $usuarios !== []) {
            $uid = $usuarios[$dia % count($usuarios)];
            $up = $conn->prepare("UPDATE usuario SET id_rua = ? WHERE id_usuario = ? LIMIT 1");
            if ($up) {
                $up->bind_param("ii", $idRua, $uid);
                $up->execute();
                $up->close();
            }
        }
        if ($uid <= 0) {
            continue;
        }

        $pontos = (int) $item["pontos"];
        $kg = (float) $item["kg"];
        $offsetDias = min($dia, max(0, (int) ((strtotime($ate) - strtotime($desde)) / 86400)));
        $data = date("Y-m-d H:i:s", strtotime($desde . " +" . $offsetDias . " days 10:00:00"));

        if ($idPev > 0) {
            $stmt = $conn->prepare(
                "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario, id_pev)
                 VALUES (?, ?, ?, ?, ?)"
            );
            if ($stmt) {
                $stmt->bind_param("sdiii", $data, $kg, $pontos, $uid, $idPev);
                $stmt->execute();
                $stmt->close();
            }
        } else {
            $stmt = $conn->prepare(
                "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario)
                 VALUES (?, ?, ?, ?)"
            );
            if ($stmt) {
                $stmt->bind_param("sdii", $data, $kg, $pontos, $uid);
                $stmt->execute();
                $stmt->close();
            }
        }
        $dia++;
    }
}

function ecorank_agregar_ruas(mysqli $conn, string $desde, string $ate): array
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return [];
    }

    $sql = "SELECT
            COALESCE(r.id_rua, 0) AS id_rua,
            COALESCE(NULLIF(TRIM(r.nome_rua), ''), 'Rua não informada') AS nome_rua,
            COALESCE(NULLIF(TRIM(b.nome_bairro), ''), '') AS nome_bairro,
            COALESCE(SUM(e.pontos_gerados), 0) AS pontos,
            COALESCE(SUM(e.peso_total), 0) AS kg
        FROM entrega e
        INNER JOIN usuario u ON u.id_usuario = e.id_usuario
        LEFT JOIN rua r ON r.id_rua = u.id_rua
        LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
        WHERE DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?
        GROUP BY r.id_rua, r.nome_rua, b.nome_bairro
        HAVING pontos > 0 OR kg > 0
        ORDER BY pontos DESC, kg DESC, nome_rua ASC
        LIMIT 100";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }
    $stmt->bind_param("ss", $desde, $ate);
    if (!$stmt->execute()) {
        $stmt->close();
        return [];
    }

    $lista = [];
    $pos = 0;
    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $pos++;
        $pontos = (int) ($row["pontos"] ?? 0);
        $kg = (float) ($row["kg"] ?? 0);
        $nomeRua = (string) ($row["nome_rua"] ?? "—");
        $bairro = (string) ($row["nome_bairro"] ?? "");
        $lista[] = [
            "posicao" => $pos,
            "id_rua" => (int) ($row["id_rua"] ?? 0),
            "nome_rua" => $nomeRua,
            "nome_bairro" => $bairro,
            "busca" => mb_strtolower($nomeRua . " " . $bairro, "UTF-8"),
            "pontos" => $pontos,
            "pontos_fmt" => ecorank_formatar_pontos($pontos),
            "kg" => round($kg, 1),
            "kg_fmt" => ecorank_formatar_kg($kg, true),
            "kg_tabela" => ecorank_formatar_kg($kg, false),
        ];
    }
    $stmt->close();

    return $lista;
}

function ecorank_encontrar_posicao_rua(array $lista, int $idRua, string $nomeRua = ""): ?array
{
    if ($idRua <= 0 && $nomeRua === "") {
        return null;
    }
    foreach ($lista as $item) {
        if ($idRua > 0 && (int) ($item["id_rua"] ?? 0) === $idRua) {
            return $item;
        }
        if ($nomeRua !== "" && strcasecmp((string) $item["nome_rua"], $nomeRua) === 0) {
            return $item;
        }
    }
    return null;
}

function ecorank_obter_rua_usuario(mysqli $conn, int $idUsuario): array
{
    if ($idUsuario <= 0 || !ecocoleta_tabela_existe($conn, "usuario")) {
        return ["id_rua" => 0, "nome_rua" => "", "nome_bairro" => ""];
    }
    $stmt = $conn->prepare(
        "SELECT u.id_rua, COALESCE(r.nome_rua, '') AS nome_rua, COALESCE(b.nome_bairro, '') AS nome_bairro
         FROM usuario u
         LEFT JOIN rua r ON r.id_rua = u.id_rua
         LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
         WHERE u.id_usuario = ? LIMIT 1"
    );
    if (!$stmt) {
        return ["id_rua" => 0, "nome_rua" => "", "nome_bairro" => ""];
    }
    $stmt->bind_param("i", $idUsuario);
    if (!$stmt->execute()) {
        $stmt->close();
        return ["id_rua" => 0, "nome_rua" => "", "nome_bairro" => ""];
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    if (!$row) {
        return ["id_rua" => 0, "nome_rua" => "", "nome_bairro" => ""];
    }
    return [
        "id_rua" => (int) ($row["id_rua"] ?? 0),
        "nome_rua" => (string) ($row["nome_rua"] ?? ""),
        "nome_bairro" => (string) ($row["nome_bairro"] ?? ""),
    ];
}

function ecorank_kg_usuario_periodo(mysqli $conn, int $idUsuario, string $desde, string $ate): float
{
    if ($idUsuario <= 0 || !ecocoleta_tabela_existe($conn, "entrega")) {
        return 0.0;
    }
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(peso_total), 0) AS kg FROM entrega
         WHERE id_usuario = ? AND DATE(data_entrega) >= ? AND DATE(data_entrega) <= ?"
    );
    if (!$stmt) {
        return 0.0;
    }
    $stmt->bind_param("iss", $idUsuario, $desde, $ate);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0.0;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    return (float) ($row["kg"] ?? 0);
}

function ecorank_kg_rua_periodo(mysqli $conn, int $idRua, string $desde, string $ate): float
{
    if ($idRua <= 0 || !ecocoleta_tabela_existe($conn, "entrega")) {
        return 0.0;
    }
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(e.peso_total), 0) AS kg
         FROM entrega e
         INNER JOIN usuario u ON u.id_usuario = e.id_usuario
         WHERE u.id_rua = ? AND DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?"
    );
    if (!$stmt) {
        return 0.0;
    }
    $stmt->bind_param("iss", $idRua, $desde, $ate);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0.0;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    return (float) ($row["kg"] ?? 0);
}

function ecorank_pontos_rua_periodo(mysqli $conn, int $idRua, string $desde, string $ate): int
{
    if ($idRua <= 0 || !ecocoleta_tabela_existe($conn, "entrega")) {
        return 0;
    }
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(e.pontos_gerados), 0) AS pts
         FROM entrega e
         INNER JOIN usuario u ON u.id_usuario = e.id_usuario
         WHERE u.id_rua = ? AND DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?"
    );
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("iss", $idRua, $desde, $ate);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    return (int) ($row["pts"] ?? 0);
}

function ecorank_resolver_posicao_rua(
    mysqli $conn,
    array $lista,
    array $ruaUser,
    string $desde,
    string $ate
): array {
    $idRua = (int) ($ruaUser["id_rua"] ?? 0);
    $nomeRua = trim((string) ($ruaUser["nome_rua"] ?? ""));

    if ($idRua <= 0 && $nomeRua === "") {
        return [
            "sem_rua" => true,
            "posicao" => 0,
            "posicao_fmt" => "—",
            "nome_rua" => "",
            "pontos" => 0,
            "pontos_fmt" => "0",
            "kg_rua" => 0.0,
            "kg_rua_fmt" => "0 kg",
            "mensagem" => "Cadastre sua rua no perfil para aparecer no ranking.",
        ];
    }

    $achou = ecorank_encontrar_posicao_rua($lista, $idRua, $nomeRua);
    if ($achou) {
        return [
            "sem_rua" => false,
            "fora_top" => false,
            "posicao" => (int) $achou["posicao"],
            "posicao_fmt" => (int) $achou["posicao"] . "º Lugar",
            "nome_rua" => (string) $achou["nome_rua"],
            "pontos" => (int) $achou["pontos"],
            "pontos_fmt" => (string) $achou["pontos_fmt"],
            "kg_rua" => (float) $achou["kg"],
            "kg_rua_fmt" => (string) $achou["kg_fmt"],
        ];
    }

    $pontos = ecorank_pontos_rua_periodo($conn, $idRua, $desde, $ate);
    $kg = ecorank_kg_rua_periodo($conn, $idRua, $desde, $ate);
    $posicao = 1;
    foreach ($lista as $item) {
        $ptsItem = (int) ($item["pontos"] ?? 0);
        $kgItem = (float) ($item["kg"] ?? 0);
        if ($ptsItem > $pontos || ($ptsItem === $pontos && $kgItem > $kg)) {
            $posicao++;
        }
    }

    return [
        "sem_rua" => false,
        "fora_top" => true,
        "posicao" => $posicao,
        "posicao_fmt" => $posicao . "º Lugar",
        "nome_rua" => $nomeRua !== "" ? $nomeRua : "Rua não informada",
        "pontos" => $pontos,
        "pontos_fmt" => ecorank_formatar_pontos($pontos),
        "kg_rua" => round($kg, 1),
        "kg_rua_fmt" => ecorank_formatar_kg($kg, true),
    ];
}

function ecorank_persistir_card_publico(
    mysqli $conn,
    string $semanaInicio,
    string $semanaFim,
    float $totalKg,
    int $totalPontos,
    int $totalRuas
): void {
    if (!ecocoleta_tabela_existe($conn, "ranking_card_publico")) {
        return;
    }
    $stmt = $conn->prepare(
        "INSERT INTO ranking_card_publico (semana_inicio, semana_fim, total_kg, total_pontos, total_ruas)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            semana_fim = VALUES(semana_fim),
            total_kg = VALUES(total_kg),
            total_pontos = VALUES(total_pontos),
            total_ruas = VALUES(total_ruas),
            atualizado_em = CURRENT_TIMESTAMP"
    );
    if (!$stmt) {
        return;
    }
    $stmt->bind_param("ssdii", $semanaInicio, $semanaFim, $totalKg, $totalPontos, $totalRuas);
    $stmt->execute();
    $stmt->close();
}

function ecorank_persistir_card_usuario(
    mysqli $conn,
    string $semanaInicio,
    int $idUsuario,
    array $cardUsuario
): void {
    if (
        $idUsuario <= 0
        || !ecocoleta_tabela_existe($conn, "ranking_card_usuario")
        || !empty($cardUsuario["sem_rua"])
    ) {
        return;
    }

    $stmt = $conn->prepare(
        "INSERT INTO ranking_card_usuario
            (semana_inicio, id_usuario, id_rua, nome_rua, kg_pessoal, kg_rua_semana,
             pontos_rua_semana, posicao_rua, total_ruas_ranking, kg_meta_mensal,
             kg_mes_atual, percentual_meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            id_rua = VALUES(id_rua),
            nome_rua = VALUES(nome_rua),
            kg_pessoal = VALUES(kg_pessoal),
            kg_rua_semana = VALUES(kg_rua_semana),
            pontos_rua_semana = VALUES(pontos_rua_semana),
            posicao_rua = VALUES(posicao_rua),
            total_ruas_ranking = VALUES(total_ruas_ranking),
            kg_meta_mensal = VALUES(kg_meta_mensal),
            kg_mes_atual = VALUES(kg_mes_atual),
            percentual_meta = VALUES(percentual_meta),
            atualizado_em = CURRENT_TIMESTAMP"
    );
    if (!$stmt) {
        return;
    }

    $idRua = (int) ($cardUsuario["id_rua"] ?? 0);
    $nomeRua = (string) ($cardUsuario["nome_rua"] ?? "");
    $kgPessoal = (float) ($cardUsuario["kg_pessoal"] ?? 0);
    $kgRua = (float) ($cardUsuario["kg_rua"] ?? 0);
    $pontosRua = (int) ($cardUsuario["pontos"] ?? 0);
    $posicao = (int) ($cardUsuario["posicao"] ?? 0);
    $totalRuas = (int) ($cardUsuario["total_ruas_ranking"] ?? 0);
    $metaKg = (float) ($cardUsuario["meta_kg"] ?? 1200);
    $kgMes = (float) ($cardUsuario["kg_mes_atual"] ?? 0);
    $pct = (int) ($cardUsuario["percentual_meta"] ?? 0);

    $stmt->bind_param(
        "siisddiiiddi",
        $semanaInicio,
        $idUsuario,
        $idRua,
        $nomeRua,
        $kgPessoal,
        $kgRua,
        $pontosRua,
        $posicao,
        $totalRuas,
        $metaKg,
        $kgMes,
        $pct
    );
    $stmt->execute();
    $stmt->close();
}

function ecorank_montar_cards(
    mysqli $conn,
    int $idUsuario,
    array $lista,
    array $intervalo,
    float $totalKg,
    int $totalPontos
): array {
    $totalRuas = count($lista);
    $semanaInicio = (string) $intervalo["desde"];
    $semanaFim = (string) $intervalo["ate"];

    ecorank_persistir_card_publico(
        $conn,
        $semanaInicio,
        $semanaFim,
        $totalKg,
        $totalPontos,
        $totalRuas
    );

    $cards = [
        "total_reciclado" => [
            "kg" => round($totalKg, 1),
            "kg_fmt" => ecorank_formatar_kg_card($totalKg),
            "rotulo" => "Materiais reciclados na semana",
            "escopo" => "comunidade",
        ],
        "posicao_semanal" => [
            "sem_rua" => true,
            "posicao" => 0,
            "posicao_fmt" => "—",
            "nome_rua" => "",
            "mensagem" => "Entre na sua conta para ver a posição da sua rua.",
        ],
        "progresso_mensal" => null,
        "usuario_logado" => $idUsuario > 0,
    ];

    if ($idUsuario <= 0) {
        return $cards;
    }

    $ruaUser = ecorank_obter_rua_usuario($conn, $idUsuario);
    $posicao = ecorank_resolver_posicao_rua(
        $conn,
        $lista,
        $ruaUser,
        $semanaInicio,
        $semanaFim
    );

    $kgPessoal = ecorank_kg_usuario_periodo($conn, $idUsuario, $semanaInicio, $semanaFim);
    $progresso = null;
    $idRua = (int) ($ruaUser["id_rua"] ?? 0);
    if ($idRua > 0) {
        $progresso = ecorank_progresso_mensal_rua($conn, $idRua);
        $progresso["rotulo"] = ecorank_formatar_kg((float) $progresso["kg_atual"], false)
            . " de " . (int) $progresso["meta_kg"] . "kg (sua rua)";
    } else {
        $progresso = ecorank_progresso_mensal_usuario($conn, $idUsuario);
    }

    $cards["total_reciclado"]["kg_pessoal"] = round($kgPessoal, 1);
    $cards["total_reciclado"]["kg_pessoal_fmt"] = ecorank_formatar_kg_card($kgPessoal);
    $cards["total_reciclado"]["rotulo_logado"] = "Seus materiais reciclados na semana";

    $cards["posicao_semanal"] = $posicao;
    $cards["posicao_semanal"]["total_ruas_ranking"] = $totalRuas;
    $cards["posicao_semanal"]["id_rua"] = $idRua;
    $cards["posicao_semanal"]["kg_pessoal"] = round($kgPessoal, 1);
    $cards["posicao_semanal"]["kg_pessoal_fmt"] = ecorank_formatar_kg_card($kgPessoal);

    if ($progresso) {
        $cards["progresso_mensal"] = $progresso;
        $cards["posicao_semanal"]["meta_kg"] = (int) ($progresso["meta_kg"] ?? 1200);
        $cards["posicao_semanal"]["kg_mes_atual"] = (int) ($progresso["kg_atual"] ?? 0);
        $cards["posicao_semanal"]["percentual_meta"] = (int) ($progresso["percentual"] ?? 0);
    }

    ecorank_persistir_card_usuario($conn, $semanaInicio, $idUsuario, $cards["posicao_semanal"]);

    return $cards;
}

function ecorank_progresso_mensal_usuario(mysqli $conn, int $idUsuario, float $metaKg = 120.0): array
{
    $intervalo = ecorank_intervalo("mes");
    $kg = ecorank_kg_usuario_periodo($conn, $idUsuario, $intervalo["desde"], $intervalo["ate"]);
    $metaKg = max(1.0, $metaKg);
    $pct = (int) min(100, max(0, round(($kg / $metaKg) * 100)));

    return [
        "kg_atual" => (int) round($kg),
        "meta_kg" => (int) round($metaKg),
        "percentual" => $pct,
        "rotulo" => ecorank_formatar_kg($kg, false) . " de " . (int) round($metaKg) . "kg",
        "escopo" => "pessoal",
    ];
}

function ecorank_progresso_mensal_rua(mysqli $conn, int $idRua, float $metaKg = 1200.0): array
{
    $intervalo = ecorank_intervalo("mes");
    $kg = 0.0;

    if ($idRua > 0 && ecocoleta_tabela_existe($conn, "entrega")) {
        $stmt = $conn->prepare(
            "SELECT COALESCE(SUM(e.peso_total), 0) AS kg
             FROM entrega e
             INNER JOIN usuario u ON u.id_usuario = e.id_usuario
             WHERE u.id_rua = ? AND DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?"
        );
        if ($stmt) {
            $stmt->bind_param("iss", $idRua, $intervalo["desde"], $intervalo["ate"]);
            if ($stmt->execute()) {
                $row = ecocoleta_stmt_fetch_one_assoc($stmt);
                $kg = (float) ($row["kg"] ?? 0);
            }
            $stmt->close();
        }
    }

    $metaKg = max(1.0, $metaKg);
    $pct = (int) min(100, max(0, round(($kg / $metaKg) * 100)));

    return [
        "kg_atual" => (int) round($kg),
        "meta_kg" => (int) round($metaKg),
        "percentual" => $pct,
        "rotulo" => ecorank_formatar_kg($kg, false) . " de " . (int) round($metaKg) . "kg",
        "escopo" => "rua",
    ];
}

function ecorank_montar_payload(mysqli $conn, string $periodo = "semana", int $idUsuario = 0): array
{
    $rotacao = ecorank_processar_rotacao_semanal($conn, $idUsuario);

    $intervalo = ecorank_intervalo($periodo);

    if ($periodo === "semana") {
        ecorank_garantir_dados_periodo($conn, $intervalo["desde"], $intervalo["ate"]);
    }

    $lista = ecorank_agregar_ruas($conn, $intervalo["desde"], $intervalo["ate"]);

    $totalKg = 0.0;
    $totalPontos = 0;
    foreach ($lista as $item) {
        $totalKg += (float) $item["kg"];
        $totalPontos += (int) $item["pontos"];
    }

    $lider = $lista[0] ?? null;
    $podio = array_slice($lista, 0, 3);

    $cards = ecorank_montar_cards($conn, $idUsuario, $lista, $intervalo, $totalKg, $totalPontos);

    $minhaRua = null;
    $progresso = $cards["progresso_mensal"] ?? null;
    $posCard = $cards["posicao_semanal"] ?? [];
    if ($idUsuario > 0 && empty($posCard["sem_rua"]) && (int) ($posCard["posicao"] ?? 0) > 0) {
        $minhaRua = [
            "posicao" => (int) $posCard["posicao"],
            "nome_rua" => (string) ($posCard["nome_rua"] ?? ""),
            "pontos" => (int) ($posCard["pontos"] ?? 0),
            "kg_rua" => (float) ($posCard["kg_rua"] ?? 0),
            "fora_top" => !empty($posCard["fora_top"]),
        ];
    }

    return [
        "periodo" => $intervalo["rotulo"],
        "desde" => $intervalo["desde"],
        "ate" => $intervalo["ate"],
        "atualizado_em" => date("c"),
        "lider" => $lider ? [
            "nome_rua" => $lider["nome_rua"],
            "pontos_fmt" => $lider["pontos_fmt"],
            "pontos" => $lider["pontos"],
        ] : null,
        "podio" => $podio,
        "lista" => $lista,
        "resumo" => [
            "total_kg" => round($totalKg, 1),
            "total_kg_fmt" => ecorank_formatar_kg_card($totalKg),
            "total_pontos" => $totalPontos,
            "total_ruas" => count($lista),
        ],
        "minha_rua" => $minhaRua,
        "progresso_mensal" => $progresso,
        "cards" => $cards,
        "premio_semanal" => [
            "pontos" => ECORANK_BONUS_PONTOS,
            "descricao" => "Moradores da rua campeã ganham "
                . ECORANK_BONUS_PONTOS
                . " EcoPoints ao fechar a semana (dados das coletas do EcoPonto).",
        ],
        "bonificacao_recebida" => $rotacao["bonificacao_recebida"],
        "vencedor_semana_anterior" => $rotacao["vencedor_semana_anterior"],
        "meta" => ["fonte" => "banco", "rotacao" => "semanal_automatica"],
    ];
}
