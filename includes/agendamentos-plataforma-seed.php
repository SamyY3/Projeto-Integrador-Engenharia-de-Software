<?php

declare(strict_types=1);

require_once __DIR__ . "/conexao.php";
require_once __DIR__ . "/admin-ecoponto-data.php";

const ECOAGEND_EMAIL_SUFFIX = "@agendamento.seed.ecocoleta.local";
const ECOAGEND_SENHA_PADRAO = "Morador@123";

function ecoagend_carregar_modelo(): array
{
    $path = __DIR__ . "/agendamentos-plataforma-demo.php";
    if (!is_file($path)) {
        return [];
    }
    $rows = require $path;
    return is_array($rows) ? $rows : [];
}

function ecoagend_garantir_enum_cancelado(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
        return;
    }
    @$conn->query(
        "ALTER TABLE agendamento_coleta_morador
         MODIFY status_coleta ENUM('confirmado','andamento','concluida','cancelado')
         NOT NULL DEFAULT 'confirmado'"
    );
    ecoadm_invalidar_cache_agendamento();
}

function ecoagend_slug_nome(string $nome): string
{
    $nome = mb_strtolower(trim($nome), "UTF-8");
    $de = ["á", "à", "â", "ã", "é", "è", "ê", "í", "ó", "ô", "õ", "ú", "ç"];
    $para = ["a", "a", "a", "a", "e", "e", "e", "i", "o", "o", "o", "u", "c"];
    $nome = str_replace($de, $para, $nome);
    $nome = preg_replace("/[^a-z0-9]+/", ".", $nome) ?? "";
    return trim($nome, ".");
}

function ecoagend_garantir_bairro_rua(mysqli $conn, string $nomeBairro, string $cidade): int
{
    $nomeBairro = trim($nomeBairro);
    $cidade = trim($cidade) !== "" ? trim($cidade) : "Juazeiro do Norte";

    if ($nomeBairro === "") {
        $nomeBairro = "Centro";
    }

    $idBairro = 0;
    $stmt = $conn->prepare("SELECT id_bairro FROM bairro WHERE nome_bairro = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("s", $nomeBairro);
        $stmt->execute();
        $stmt->bind_result($idBairro);
        $stmt->fetch();
        $stmt->close();
    }

    if ($idBairro <= 0) {
        $ins = $conn->prepare("INSERT INTO bairro (nome_bairro) VALUES (?)");
        if ($ins) {
            $ins->bind_param("s", $nomeBairro);
            $ins->execute();
            $idBairro = (int) $conn->insert_id;
            $ins->close();
        }
    }

    $nomeRua = "Rua " . $nomeBairro;
    $idRua = 0;
    $stmtR = $conn->prepare(
        "SELECT id_rua FROM rua WHERE nome_rua = ? AND id_bairro = ? LIMIT 1"
    );
    if ($stmtR) {
        $stmtR->bind_param("si", $nomeRua, $idBairro);
        $stmtR->execute();
        $stmtR->bind_result($idRua);
        $stmtR->fetch();
        $stmtR->close();
    }

    if ($idRua <= 0 && $idBairro > 0) {
        $insR = $conn->prepare("INSERT INTO rua (nome_rua, id_bairro) VALUES (?, ?)");
        if ($insR) {
            $insR->bind_param("si", $nomeRua, $idBairro);
            $insR->execute();
            $idRua = (int) $conn->insert_id;
            $insR->close();
        }
    }

    return $idRua;
}

function ecoagend_garantir_usuario(mysqli $conn, string $nome, string $bairro): int
{
    $nome = trim($nome);
    if ($nome === "") {
        return 0;
    }

    $stmt = $conn->prepare("SELECT id_usuario FROM usuario WHERE nome = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("s", $nome);
        $stmt->execute();
        $id = 0;
        $stmt->bind_result($id);
        if ($stmt->fetch() && $id > 0) {
            $stmt->close();
            return (int) $id;
        }
        $stmt->close();
    }

    $slug = ecoagend_slug_nome($nome);
    $email = $slug . ECOAGEND_EMAIL_SUFFIX;

    $stmtE = $conn->prepare("SELECT id_usuario FROM usuario WHERE email = ? LIMIT 1");
    if ($stmtE) {
        $stmtE->bind_param("s", $email);
        $stmtE->execute();
        $id = 0;
        $stmtE->bind_result($id);
        if ($stmtE->fetch() && $id > 0) {
            $stmtE->close();
            return (int) $id;
        }
        $stmtE->close();
    }

    $idRua = ecoagend_garantir_bairro_rua($conn, $bairro, "Juazeiro do Norte");
    $senhaHash = password_hash(ECOAGEND_SENHA_PADRAO, PASSWORD_DEFAULT);
    if ($senhaHash === false) {
        return 0;
    }

    $tipo = "morador";
    $cidade = "Juazeiro do Norte";
    $numero = (string) random_int(10, 999);

    if (ecopontos_coluna_existe_seed($conn, "status_conta")) {
        $sql = "INSERT INTO usuario (nome, email, senha_hash, tipo_usuario, id_rua, numero, cidade, status_conta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmtIns = $conn->prepare($sql);
        if (!$stmtIns) {
            return 0;
        }
        $statusConta = "ativo";
        $stmtIns->bind_param(
            "ssssisss",
            $nome,
            $email,
            $senhaHash,
            $tipo,
            $idRua,
            $numero,
            $cidade,
            $statusConta
        );
    } else {
        $sql = "INSERT INTO usuario (nome, email, senha_hash, tipo_usuario, id_rua, numero, cidade)
                VALUES (?, ?, ?, ?, ?, ?, ?)";
        $stmtIns = $conn->prepare($sql);
        if (!$stmtIns) {
            return 0;
        }
        $stmtIns->bind_param("ssssiss", $nome, $email, $senhaHash, $tipo, $idRua, $numero, $cidade);
    }

    if (!$stmtIns->execute()) {
        $stmtIns->close();
        return 0;
    }
    $idUsuario = (int) $conn->insert_id;
    $stmtIns->close();

    return $idUsuario;
}

function ecopontos_coluna_existe_seed(mysqli $conn, string $coluna): bool
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        $res = @$conn->query("SHOW COLUMNS FROM usuario");
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $cache[$row["Field"]] = true;
            }
            $res->free();
        }
    }
    return !empty($cache[$coluna]);
}

function ecoagend_remover_duplicados_logicos(mysqli $conn): int
{
    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return 0;
    }

    $temPev = ecoadm_agendamento_tem_coluna($conn, "id_pev");
    $joinPev = $temPev
        ? " AND COALESCE(a.id_pev, 0) = COALESCE(b.id_pev, 0)"
        : "";

    $sql = "DELETE a FROM agendamento_coleta_morador a
            INNER JOIN agendamento_coleta_morador b
              ON a.id_usuario = b.id_usuario
             AND a.data_coleta = b.data_coleta
             AND a.status_coleta = b.status_coleta
             AND a.tipo_coleta = b.tipo_coleta
             {$joinPev}
             AND a.id_agendamento < b.id_agendamento";

    if (!@$conn->query($sql)) {
        return 0;
    }

    $removidos = (int) $conn->affected_rows;
    if ($removidos > 0) {
        ecoadm_invalidar_cache_agendamento();
    }

    return $removidos;
}

function ecoagend_slot_livre(mysqli $conn, int $idUsuario, string $dataColeta, int $slotPreferido): int
{
    for ($tentativa = 0; $tentativa < 5; $tentativa++) {
        $slot = $slotPreferido + $tentativa;
        if ($slot > 4) {
            $slot = 4;
        }
        $stmt = $conn->prepare(
            "SELECT id_agendamento FROM agendamento_coleta_morador
             WHERE id_usuario = ? AND data_coleta = ? AND slot_ordem = ? LIMIT 1"
        );
        if (!$stmt) {
            return $slotPreferido;
        }
        $stmt->bind_param("isi", $idUsuario, $dataColeta, $slot);
        $stmt->execute();
        $stmt->store_result();
        $ocupado = $stmt->num_rows > 0;
        $stmt->close();
        if (!$ocupado) {
            return $slot;
        }
    }
    return min(4, $slotPreferido + 4);
}

function ecoagend_pev_tem_coluna(mysqli $conn, string $coluna): bool
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
            return false;
        }
        $res = @$conn->query("SHOW COLUMNS FROM ponto_entrega");
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $cache[$row["Field"]] = true;
            }
            $res->free();
        }
    }
    return !empty($cache[$coluna]);
}

function ecoagend_resolver_id_pev(mysqli $conn, string $tipo, string $nomeEcoponto, string $bairro): int
{
    if ($tipo === "prefeitura") {
        return 0;
    }
    if (!ecoadm_agendamento_tem_coluna($conn, "id_pev") || !ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return 0;
    }

    $nomeEcoponto = trim($nomeEcoponto);
    if ($nomeEcoponto !== "") {
        $stmt = $conn->prepare("SELECT id_pev FROM ponto_entrega WHERE nome_ponto = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("s", $nomeEcoponto);
            $stmt->execute();
            $id = 0;
            $stmt->bind_result($id);
            if ($stmt->fetch() && $id > 0) {
                $stmt->close();
                return (int) $id;
            }
            $stmt->close();
        }
    }

    $bairro = trim($bairro);
    if ($bairro !== "") {
        if (ecoagend_pev_tem_coluna($conn, "bairro_label")) {
            $stmt = $conn->prepare(
                "SELECT id_pev FROM ponto_entrega WHERE bairro_label = ? LIMIT 1"
            );
            if ($stmt) {
                $stmt->bind_param("s", $bairro);
                $stmt->execute();
                $id = 0;
                $stmt->bind_result($id);
                if ($stmt->fetch() && $id > 0) {
                    $stmt->close();
                    return (int) $id;
                }
                $stmt->close();
            }
        }

        $like = "%" . $bairro . "%";
        $stmt = $conn->prepare(
            "SELECT id_pev FROM ponto_entrega
             WHERE nome_ponto LIKE ? OR endereco LIKE ?
             ORDER BY id_pev ASC LIMIT 1"
        );
        if ($stmt) {
            $stmt->bind_param("ss", $like, $like);
            $stmt->execute();
            $id = 0;
            $stmt->bind_result($id);
            if ($stmt->fetch() && $id > 0) {
                $stmt->close();
                return (int) $id;
            }
            $stmt->close();
        }
    }

    return 0;
}

function ecoagend_vincular_pev_existentes(mysqli $conn): int
{
    if (!ecoadm_agendamento_tem_coluna($conn, "id_pev")) {
        return 0;
    }

    $atualizados = 0;
    foreach (ecoagend_carregar_modelo() as $item) {
        if (!is_array($item)) {
            continue;
        }

        $nome = trim((string) ($item["usuario"] ?? ""));
        $dataColeta = trim((string) ($item["data_coleta"] ?? ""));
        if ($dataColeta === "" && preg_match('/(\d{2})\/(\d{2})\/(\d{4})/', (string) ($item["horario_solicitacao"] ?? ""), $m)) {
            $dataColeta = $m[3] . "-" . $m[2] . "-" . $m[1];
        }
        if ($nome === "" || $dataColeta === "") {
            continue;
        }

        $tipo = strtolower(trim((string) ($item["tipo"] ?? "caminhao")));
        if ($tipo !== "prefeitura") {
            $tipo = "caminhao";
        }

        $idPev = ecoagend_resolver_id_pev(
            $conn,
            $tipo,
            trim((string) ($item["nome_ecoponto"] ?? "")),
            trim((string) ($item["bairro"] ?? ""))
        );

        if ($tipo === "prefeitura") {
            $stmt = $conn->prepare(
                "UPDATE agendamento_coleta_morador a
                 INNER JOIN usuario u ON u.id_usuario = a.id_usuario
                 SET a.id_pev = NULL
                 WHERE u.nome = ? AND a.data_coleta = ? AND a.tipo_coleta = 'prefeitura'"
            );
            if (!$stmt) {
                continue;
            }
            $stmt->bind_param("ss", $nome, $dataColeta);
        } else {
            if ($idPev <= 0) {
                continue;
            }
            $stmt = $conn->prepare(
                "UPDATE agendamento_coleta_morador a
                 INNER JOIN usuario u ON u.id_usuario = a.id_usuario
                 SET a.id_pev = ?
                 WHERE u.nome = ? AND a.data_coleta = ? AND a.tipo_coleta = 'caminhao'"
            );
            if (!$stmt) {
                continue;
            }
            $stmt->bind_param("iss", $idPev, $nome, $dataColeta);
        }

        if ($stmt->execute() && $stmt->affected_rows > 0) {
            $atualizados++;
        }
        $stmt->close();
    }

    if ($atualizados > 0) {
        ecoadm_invalidar_cache_agendamento();
    }

    return $atualizados;
}

function ecoagend_contar(mysqli $conn): int
{
    if (!ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
        return 0;
    }
    $res = @$conn->query("SELECT COUNT(*) AS c FROM agendamento_coleta_morador");
    if (!$res) {
        return 0;
    }
    $row = $res->fetch_assoc();
    $res->free();
    return (int) ($row["c"] ?? 0);
}

function ecoagend_sincronizar_seed(mysqli $conn, bool $apenas_faltantes = true): array
{
    ecoadm_garantir_schema_integracao($conn);
    ecoagend_garantir_enum_cancelado($conn);

    $stats = ["inseridos" => 0, "usuarios_criados" => 0, "total" => 0];

    $modelo = ecoagend_carregar_modelo();
    if ($modelo === []) {
        return $stats;
    }

    if ($apenas_faltantes && ecoagend_contar($conn) >= count($modelo)) {
        $stats["total"] = ecoagend_contar($conn);
        ecoagend_vincular_pev_existentes($conn);
        return $stats;
    }

    $usuariosCriados = 0;

    foreach ($modelo as $item) {
        if (!is_array($item)) {
            continue;
        }

        $nome = trim((string) ($item["usuario"] ?? ""));
        $bairro = trim((string) ($item["bairro"] ?? "Centro"));
        $dataColeta = trim((string) ($item["data_coleta"] ?? ""));
        if ($dataColeta === "" && preg_match('/(\d{2})\/(\d{2})\/(\d{4})/', (string) ($item["horario_solicitacao"] ?? ""), $m)) {
            $dataColeta = $m[3] . "-" . $m[2] . "-" . $m[1];
        }
        if ($nome === "" || $dataColeta === "") {
            continue;
        }

        $antes = 0;
        $stmtCnt = $conn->prepare("SELECT COUNT(*) AS c FROM usuario WHERE nome = ?");
        if ($stmtCnt) {
            $stmtCnt->bind_param("s", $nome);
            $stmtCnt->execute();
            $stmtCnt->bind_result($antes);
            $stmtCnt->fetch();
            $stmtCnt->close();
        }

        $idUsuario = ecoagend_garantir_usuario($conn, $nome, $bairro);
        if ($idUsuario <= 0) {
            continue;
        }

        if ($antes === 0) {
            $usuariosCriados++;
        }

        $slot = (int) ($item["slot_ordem"] ?? 0);
        if ($slot < 0) {
            $slot = 0;
        }
        if ($slot > 4) {
            $slot = 4;
        }

        $status = strtolower(trim((string) ($item["status"] ?? "confirmado")));
        if (!in_array($status, ["confirmado", "andamento", "concluida", "cancelado"], true)) {
            $status = "confirmado";
        }

        $tipo = strtolower(trim((string) ($item["tipo"] ?? "caminhao")));
        if ($tipo !== "prefeitura") {
            $tipo = "caminhao";
        }

        $nomeEcoponto = trim((string) ($item["nome_ecoponto"] ?? ""));
        $idPev = ecoagend_resolver_id_pev($conn, $tipo, $nomeEcoponto, $bairro);
        $nomePev = $nomeEcoponto !== "" ? $nomeEcoponto : ecoadm_nome_pev_por_id($conn, $idPev);
        $resp = ecoadm_rotulo_responsavel($tipo, $nomePev);
        $temColPev = ecoadm_agendamento_tem_coluna($conn, "id_pev");

        if ($temColPev) {
            $stmt = $conn->prepare(
                "INSERT INTO agendamento_coleta_morador
                 (id_usuario, data_coleta, slot_ordem, status_coleta, tipo_coleta, responsavel, id_pev)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   status_coleta = VALUES(status_coleta),
                   tipo_coleta = VALUES(tipo_coleta),
                   responsavel = VALUES(responsavel),
                   id_pev = VALUES(id_pev)"
            );
            if (!$stmt) {
                continue;
            }
            $idPevBind = $idPev > 0 ? $idPev : null;
            $stmt->bind_param("isisssi", $idUsuario, $dataColeta, $slot, $status, $tipo, $resp, $idPevBind);
        } else {
            $stmt = $conn->prepare(
                "INSERT INTO agendamento_coleta_morador
                 (id_usuario, data_coleta, slot_ordem, status_coleta, tipo_coleta, responsavel)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   status_coleta = VALUES(status_coleta),
                   tipo_coleta = VALUES(tipo_coleta),
                   responsavel = VALUES(responsavel)"
            );
            if (!$stmt) {
                continue;
            }
            $stmt->bind_param("isisss", $idUsuario, $dataColeta, $slot, $status, $tipo, $resp);
        }

        if ($stmt->execute() && $stmt->affected_rows > 0) {
            $stats["inseridos"]++;
        }
        $stmt->close();
    }

    ecoagend_vincular_pev_existentes($conn);
    $stats["duplicados_removidos"] = ecoagend_remover_duplicados_logicos($conn);

    $stats["usuarios_criados"] = $usuariosCriados;
    $stats["total"] = ecoagend_contar($conn);
    return $stats;
}

function ecoagend_remover_seed(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
        return;
    }

    $like = "%" . ECOAGEND_EMAIL_SUFFIX;
    $stmt = $conn->prepare(
        "DELETE a FROM agendamento_coleta_morador a
         INNER JOIN usuario u ON u.id_usuario = a.id_usuario
         WHERE u.email LIKE ?"
    );
    if ($stmt) {
        $stmt->bind_param("s", $like);
        $stmt->execute();
        $stmt->close();
    }

    $stmtU = $conn->prepare("DELETE FROM usuario WHERE email LIKE ?");
    if ($stmtU) {
        $stmtU->bind_param("s", $like);
        $stmtU->execute();
        $stmtU->close();
    }
}
