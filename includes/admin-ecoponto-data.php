<?php

require_once __DIR__ . "/admin-ecoponto-helpers.php";
require_once __DIR__ . "/notificacoes_helper.php";
require_once __DIR__ . "/ecopontos-repository.php";
require_once __DIR__ . "/ecoponto-agendamento.php";

function ecoadm_usuario_tem_coluna(mysqli $conn, string $nome): bool
{
    if (!isset($GLOBALS["ecoadm_usuario_cols_cache"]) || !is_array($GLOBALS["ecoadm_usuario_cols_cache"])) {
        $GLOBALS["ecoadm_usuario_cols_cache"] = [];
        if (ecocoleta_tabela_existe($conn, "usuario")) {
            $q = @$conn->query("SHOW COLUMNS FROM usuario");
            if ($q) {
                while ($row = $q->fetch_assoc()) {
                    $GLOBALS["ecoadm_usuario_cols_cache"][$row["Field"]] = true;
                }
                $q->free();
            }
        }
    }
    return !empty($GLOBALS["ecoadm_usuario_cols_cache"][$nome]);
}

function ecoadm_agendamento_tem_coluna(mysqli $conn, string $nome): bool
{
    if (!isset($GLOBALS["ecoadm_agend_cols_cache"]) || !is_array($GLOBALS["ecoadm_agend_cols_cache"])) {
        $GLOBALS["ecoadm_agend_cols_cache"] = [];
        if (ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
            $q = @$conn->query("SHOW COLUMNS FROM agendamento_coleta_morador");
            if ($q) {
                while ($row = $q->fetch_assoc()) {
                    $GLOBALS["ecoadm_agend_cols_cache"][$row["Field"]] = true;
                }
                $q->free();
            }
        }
    }
    return !empty($GLOBALS["ecoadm_agend_cols_cache"][$nome]);
}

function ecoadm_invalidar_cache_agendamento(): void
{
    $GLOBALS["ecoadm_agend_cols_cache"] = null;
}

function ecoadm_entrega_tem_coluna(mysqli $conn, string $nome): bool
{
    if (!isset($GLOBALS["ecoadm_entrega_cols_cache"]) || !is_array($GLOBALS["ecoadm_entrega_cols_cache"])) {
        $GLOBALS["ecoadm_entrega_cols_cache"] = [];
        if (ecocoleta_tabela_existe($conn, "entrega")) {
            $q = @$conn->query("SHOW COLUMNS FROM entrega");
            if ($q) {
                while ($row = $q->fetch_assoc()) {
                    $GLOBALS["ecoadm_entrega_cols_cache"][$row["Field"]] = true;
                }
                $q->free();
            }
        }
    }
    return !empty($GLOBALS["ecoadm_entrega_cols_cache"][$nome]);
}

function ecoadm_invalidar_cache_entrega(): void
{
    $GLOBALS["ecoadm_entrega_cols_cache"] = null;
}

function ecoadm_garantir_colunas_entrega_materiais(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return;
    }
    if (!ecoadm_entrega_tem_coluna($conn, "status_material")) {
        @$conn->query(
            "ALTER TABLE entrega
             ADD COLUMN status_material ENUM('recebido','coletado') NOT NULL DEFAULT 'recebido' AFTER id_pev"
        );
        ecoadm_invalidar_cache_entrega();
    }
    if (!ecoadm_entrega_tem_coluna($conn, "id_agendamento")) {
        @$conn->query(
            "ALTER TABLE entrega
             ADD COLUMN id_agendamento INT NULL DEFAULT NULL AFTER status_material"
        );
        @$conn->query(
            "ALTER TABLE entrega ADD KEY idx_entrega_agendamento (id_agendamento)"
        );
        ecoadm_invalidar_cache_entrega();
    }
    if (!ecoadm_entrega_tem_coluna($conn, "responsavel")) {
        @$conn->query(
            "ALTER TABLE entrega
             ADD COLUMN responsavel VARCHAR(80) NULL DEFAULT NULL AFTER id_agendamento"
        );
        ecoadm_invalidar_cache_entrega();
    }
}

function ecoadm_responsavel_parece_instituicao(string $resp, string $nomePev = ""): bool
{
    $r = mb_strtolower(trim($resp), "UTF-8");
    if ($r === "" || $r === "—" || $r === "-") {
        return true;
    }
    if (str_contains($r, "ecoponto") || str_contains($r, "prefeitura")) {
        return true;
    }
    if ($nomePev !== "" && strcasecmp(trim($resp), trim($nomePev)) === 0) {
        return true;
    }
    return false;
}

function ecoadm_obter_equipe_responsaveis_ordenada(mysqli $conn, int $idPev): array
{
    if (!ecocoleta_tabela_existe($conn, "administrador_ecoponto")) {
        return [];
    }

    ecoadm_garantir_admins_ecoponto_equipe($conn);

    $nomePev = ecoadm_nome_pev_por_id($conn, $idPev);
    $nomeEco = $nomePev !== "" ? $nomePev : ecoadm_pev_padrao_nome();
    $lista = [];

    if (ecoadm_admin_tem_coluna($conn, "funcao")) {
        $sql = "SELECT nome, funcao FROM administrador_ecoponto WHERE status = 'ativo'";
        $params = [];
        $types = "";
        if ($idPev > 0 && ecoadm_admin_tem_coluna($conn, "id_pev")) {
            $sql .= " AND id_pev = ?";
            $params[] = $idPev;
            $types .= "i";
        } elseif ($nomeEco !== "") {
            $sql .= " AND nome_ecoponto = ?";
            $params[] = $nomeEco;
            $types .= "s";
        }
        $sql .= " ORDER BY FIELD(funcao, 'titular', 'gestor', 'operador'), nome ASC LIMIT 20";

        $stmt = $conn->prepare($sql);
        if ($stmt) {
            if ($types !== "") {
                $stmt->bind_param($types, ...$params);
            }
            if ($stmt->execute()) {
                foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
                    $nome = trim((string) ($row["nome"] ?? ""));
                    if ($nome === "" || strcasecmp($nome, "Administrador EcoPonto") === 0) {
                        continue;
                    }
                    $lista[] = $nome;
                }
            }
            $stmt->close();
        }
    }

    if ($lista !== []) {
        return $lista;
    }

    foreach (ecoadm_listar_administradores_pev($conn, $idPev, $nomeEco, 0) as $admin) {
        $nome = trim((string) ($admin["nome"] ?? ""));
        if ($nome !== "" && strcasecmp($nome, "Administrador EcoPonto") !== 0) {
            $lista[] = $nome;
        }
    }

    return $lista;
}

function ecoadm_resolver_responsavel_admin(
    mysqli $conn,
    int $idPev,
    string $respInformado = "",
    int $indiceRodizio = 0
): string {
    $nomePev = ecoadm_nome_pev_por_id($conn, $idPev);
    $resp = trim($respInformado);
    if ($resp !== "" && !ecoadm_responsavel_parece_instituicao($resp, $nomePev)) {
        return mb_substr($resp, 0, 80, "UTF-8");
    }

    $equipe = ecoadm_obter_equipe_responsaveis_ordenada($conn, $idPev);
    if ($equipe === []) {
        return ecoadm_rotulo_responsavel("caminhao", $nomePev);
    }

    return $equipe[abs($indiceRodizio) % count($equipe)];
}

function ecoadm_distribuir_responsaveis_entregas_pev(mysqli $conn, int $idPev): int
{
    if ($idPev <= 0 || !ecoadm_entrega_tem_coluna($conn, "responsavel")) {
        return 0;
    }

    $equipe = ecoadm_obter_equipe_responsaveis_ordenada($conn, $idPev);
    if ($equipe === []) {
        return 0;
    }

    $nomePev = ecoadm_nome_pev_por_id($conn, $idPev);
    $filtroPev = ecoadm_sql_filtro_pev_entrega($idPev, "e");
    $sql = "SELECT e.id_entrega,
                   COALESCE(NULLIF(TRIM(e.responsavel), ''), '') AS resp_atual
            FROM entrega e
            WHERE {$filtroPev}
            ORDER BY e.data_entrega ASC, e.id_entrega ASC";

    $res = @$conn->query($sql);
    if (!$res) {
        return 0;
    }

    $stmtUp = $conn->prepare("UPDATE entrega SET responsavel = ? WHERE id_entrega = ? LIMIT 1");
    if (!$stmtUp) {
        $res->free();
        return 0;
    }

    $atualizados = 0;
    $idx = 0;
    $totalEquipe = count($equipe);

    while ($row = $res->fetch_assoc()) {
        $idEntrega = (int) ($row["id_entrega"] ?? 0);
        if ($idEntrega <= 0) {
            continue;
        }
        $respAtual = (string) ($row["resp_atual"] ?? "");
        if (!ecoadm_responsavel_parece_instituicao($respAtual, $nomePev)) {
            continue;
        }
        $respNovo = $equipe[$idx % $totalEquipe];
        $idx++;
        $stmtUp->bind_param("si", $respNovo, $idEntrega);
        if ($stmtUp->execute() && $stmtUp->affected_rows > 0) {
            $atualizados++;
        }
    }
    $stmtUp->close();
    $res->free();

    return $atualizados;
}

function ecoadm_responsavel_linha_material(mysqli $conn, int $idPev, array $row): string
{
    $nomePev = (string) ($row["nome_ponto"] ?? ecoadm_nome_pev_por_id($conn, $idPev));
    $respSalvo = trim((string) ($row["responsavel_entrega"] ?? $row["responsavel"] ?? ""));
    if ($respSalvo !== "" && !ecoadm_responsavel_parece_instituicao($respSalvo, $nomePev)) {
        return $respSalvo;
    }

    $equipe = ecoadm_obter_equipe_responsaveis_ordenada($conn, $idPev);
    if ($equipe === []) {
        return ecoadm_rotulo_responsavel("caminhao", $nomePev);
    }

    $idEntrega = (int) ($row["id_entrega"] ?? 0);
    $chave = $idEntrega > 0 ? $idEntrega : (int) ($row["id_item_entrega"] ?? 0);
    if ($chave <= 0) {
        $chave = crc32(json_encode([$row["data_entrega"] ?? "", $row["material"] ?? ""]));
    }

    return $equipe[abs($chave) % count($equipe)];
}

function ecoadm_status_linha_material(array $row): string
{
    $status = strtolower(trim((string) ($row["status_material"] ?? "")));
    return $status === "coletado" ? "coletado" : "recebido";
}

function ecoadm_garantir_schema_sessao(mysqli $conn): void
{
    if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION["ecoadm_schema_ok"])) {
        return;
    }
    ecoadm_garantir_schema_integracao($conn);
    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION["ecoadm_schema_ok"] = true;
    }
}

function ecoadm_garantir_schema_integracao(mysqli $conn): void
{
    ecoadm_garantir_colunas_admin($conn);
    ecopontos_garantir_schema($conn);

    if (!ecoadm_admin_tem_coluna($conn, "id_pev")) {
        @$conn->query(
            "ALTER TABLE administrador_ecoponto
             ADD COLUMN id_pev INT NULL DEFAULT NULL AFTER nome_ecoponto"
        );
    }

    if (!ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
        @$conn->query(
            "CREATE TABLE IF NOT EXISTS agendamento_coleta_morador (
                id_agendamento INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario INT NOT NULL,
                data_coleta DATE NOT NULL,
                slot_ordem TINYINT UNSIGNED NOT NULL,
                status_coleta ENUM('confirmado','andamento','concluida','cancelado') NOT NULL DEFAULT 'confirmado',
                tipo_coleta ENUM('caminhao','prefeitura') NOT NULL DEFAULT 'caminhao',
                responsavel VARCHAR(80) NULL DEFAULT NULL,
                id_pev INT NULL DEFAULT NULL,
                criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_usuario_data_slot (id_usuario, data_coleta, slot_ordem),
                CONSTRAINT fk_agendamento_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        ecoadm_invalidar_cache_agendamento();
        ecoadm_invalidar_cache_admin();
        return;
    }

    if (!ecoadm_agendamento_tem_coluna($conn, "status_coleta")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN status_coleta ENUM('confirmado','andamento','concluida','cancelado') NOT NULL DEFAULT 'confirmado' AFTER slot_ordem"
        );
    }
    if (!ecoadm_agendamento_tem_coluna($conn, "tipo_coleta")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN tipo_coleta ENUM('caminhao','prefeitura') NOT NULL DEFAULT 'caminhao' AFTER status_coleta"
        );
    }
    if (!ecoadm_agendamento_tem_coluna($conn, "responsavel")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN responsavel VARCHAR(80) NULL DEFAULT NULL AFTER tipo_coleta"
        );
    }
    if (!ecoadm_agendamento_tem_coluna($conn, "id_pev")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN id_pev INT NULL DEFAULT NULL AFTER responsavel"
        );
    }

    ecoadm_garantir_colunas_entrega_materiais($conn);
    ecoadm_garantir_admins_ecoponto_equipe($conn);
    $idPevPadrao = ecoadm_resolver_pev_catalogo($conn, ecoadm_pev_padrao_nome());
    if ($idPevPadrao > 0) {
        ecoadm_distribuir_responsaveis_entregas_pev($conn, $idPevPadrao);
    }

    ecoadm_invalidar_cache_agendamento();
    ecoadm_invalidar_cache_admin();
    ecocoleta_ensure_notificacao_admin_table($conn);
    ecoadm_corrigir_responsaveis_armazenados($conn);
}

function ecoadm_rotulo_responsavel(string $tipoColeta, string $nomeEcoponto = ""): string
{
    $tipo = strtolower(trim($tipoColeta));
    if ($tipo === "prefeitura") {
        return "Prefeitura";
    }
    $nome = trim($nomeEcoponto);
    if ($nome !== "" && !in_array($nome, ["—", "-", "EcoPonto"], true)) {
        return $nome;
    }
    return "Ecoponto";
}

function ecoadm_resolver_nome_ecoponto_agendamento(mysqli $conn, array $row): string
{
    $nome = trim((string) ($row["nome_ecoponto"] ?? ""));
    if ($nome !== "") {
        return $nome;
    }

    $idPev = (int) ($row["id_pev"] ?? 0);
    if ($idPev > 0) {
        $nomePev = ecoadm_nome_pev_por_id($conn, $idPev);
        if ($nomePev !== "") {
            return $nomePev;
        }
    }

    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return "";
    }

    $bairro = trim((string) ($row["nome_bairro"] ?? $row["bairro"] ?? ""));
    if ($bairro === "") {
        return "";
    }

    if (preg_match('/^(.+?)\s*\(/u', $bairro, $m)) {
        $bairro = trim($m[1]);
    }

    if (function_exists("ecoagend_pev_tem_coluna") && ecoagend_pev_tem_coluna($conn, "bairro_label")) {
        $stmt = $conn->prepare(
            "SELECT COALESCE(NULLIF(TRIM(nome_ponto), ''), '') AS nome
             FROM ponto_entrega WHERE bairro_label = ? LIMIT 1"
        );
        if ($stmt) {
            $stmt->bind_param("s", $bairro);
            if ($stmt->execute()) {
                $pevRow = ecocoleta_stmt_fetch_one_assoc($stmt);
                $stmt->close();
                $nomeBairro = trim((string) ($pevRow["nome"] ?? ""));
                if ($nomeBairro !== "") {
                    return $nomeBairro;
                }
            } else {
                $stmt->close();
            }
        }
    }

    $like = "%" . $bairro . "%";
    $stmt = $conn->prepare(
        "SELECT COALESCE(NULLIF(TRIM(nome_ponto), ''), '') AS nome
         FROM ponto_entrega
         WHERE nome_ponto LIKE ? OR endereco LIKE ?
         ORDER BY id_pev ASC LIMIT 1"
    );
    if (!$stmt) {
        return "";
    }
    $stmt->bind_param("ss", $like, $like);
    if (!$stmt->execute()) {
        $stmt->close();
        return "";
    }
    $pevRow = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    return trim((string) ($pevRow["nome"] ?? ""));
}

function ecoadm_nome_pev_por_id(mysqli $conn, int $idPev): string
{
    if ($idPev <= 0 || !ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return "";
    }
    $stmt = $conn->prepare(
        "SELECT COALESCE(NULLIF(TRIM(nome_ponto), ''), '') AS nome
         FROM ponto_entrega WHERE id_pev = ? LIMIT 1"
    );
    if (!$stmt) {
        return "";
    }
    $stmt->bind_param("i", $idPev);
    if (!$stmt->execute()) {
        $stmt->close();
        return "";
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    return trim((string) ($row["nome"] ?? ""));
}

function ecoadm_corrigir_responsaveis_armazenados(mysqli $conn): void
{
    if (!ecoadm_tabela_agendamento_operacional($conn)
        || !ecoadm_agendamento_tem_coluna($conn, "responsavel")
    ) {
        return;
    }

    if (ecoadm_agendamento_tem_coluna($conn, "id_pev")
        && ecocoleta_tabela_existe($conn, "ponto_entrega")
    ) {
        @$conn->query(
            "UPDATE agendamento_coleta_morador a
             LEFT JOIN ponto_entrega p ON p.id_pev = a.id_pev
             SET a.responsavel = CASE
               WHEN a.tipo_coleta = 'prefeitura' THEN 'Prefeitura'
               WHEN TRIM(COALESCE(p.nome_ponto, '')) <> '' THEN TRIM(p.nome_ponto)
               ELSE 'Ecoponto'
             END"
        );
        return;
    }

    @$conn->query(
        "UPDATE agendamento_coleta_morador
         SET responsavel = CASE
           WHEN tipo_coleta = 'prefeitura' THEN 'Prefeitura'
           ELSE 'Ecoponto'
         END"
    );
}

function ecoadm_material_slug(?string $tipo): string
{
    $t = mb_strtolower(trim((string) $tipo), "UTF-8");
    $map = [
        "plastico" => "plastico",
        "plástico" => "plastico",
        "papel" => "papel",
        "vidro" => "vidro",
        "metal" => "metal",
        "organico" => "organico",
        "orgânico" => "organico",
        "madeira" => "madeira",
        "eletronicos" => "eletronicos",
        "eletrônicos" => "eletronicos",
    ];
    if (isset($map[$t])) {
        return $map[$t];
    }
    if (strpos($t, "plast") !== false) {
        return "plastico";
    }
    if (strpos($t, "papel") !== false) {
        return "papel";
    }
    if (strpos($t, "vidro") !== false) {
        return "vidro";
    }
    if (strpos($t, "metal") !== false) {
        return "metal";
    }
    if (strpos($t, "organ") !== false) {
        return "organico";
    }
    return "outros";
}

function ecoadm_material_label(string $slug): string
{
    $labels = [
        "plastico" => "Plástico",
        "papel" => "Papel",
        "vidro" => "Vidro",
        "metal" => "Metal",
        "organico" => "Orgânico",
        "madeira" => "Madeira",
        "eletronicos" => "Eletrônicos",
        "outros" => "Outros",
    ];
    return $labels[$slug] ?? "Outros";
}

function ecoadm_intervalo_periodo(string $periodo): array
{
    $hoje = new DateTimeImmutable("today");
    $ate = $hoje->format("Y-m-d");

    switch ($periodo) {
        case "hoje":
            return ["desde" => $ate, "ate" => $ate];
        case "semana":
            return ["desde" => $hoje->modify("-6 days")->format("Y-m-d"), "ate" => $ate];
        case "trimestre":
            return ["desde" => $hoje->modify("-89 days")->format("Y-m-d"), "ate" => $ate];
        case "semestre":
            return ["desde" => $hoje->modify("-179 days")->format("Y-m-d"), "ate" => $ate];
        case "ano":
            return ["desde" => $hoje->modify("-364 days")->format("Y-m-d"), "ate" => $ate];
        case "todos":
            return ["desde" => "2000-01-01", "ate" => $ate];
        case "mes":
        default:
            return ["desde" => $hoje->modify("first day of this month")->format("Y-m-d"), "ate" => $ate];
    }
}

function ecoadm_contar_entregas_pev_periodo(
    mysqli $conn,
    int $idPev,
    string $desde,
    string $ate
): int {
    if (!ecocoleta_tabela_existe($conn, "entrega") || $idPev <= 0) {
        return 0;
    }
    if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $desde) || !preg_match("/^\d{4}-\d{2}-\d{2}$/", $ate)) {
        return 0;
    }
    $filtro = ecoadm_sql_filtro_pev_entrega($idPev, "e");
    $sql = "SELECT COUNT(*) AS c FROM entrega e
            WHERE {$filtro}
              AND DATE(e.data_entrega) >= ?
              AND DATE(e.data_entrega) <= ?";
    $stmt = $conn->prepare($sql);
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

function ecoadm_enriquecer_linhas_relatorio(mysqli $conn, int $idPev, array $linhas): array
{
    if ($linhas === [] || !ecoadm_tabela_agendamento_operacional($conn)) {
        return $linhas;
    }

    $cache = [];
    foreach ($linhas as &$linha) {
        $dataIso = (string) ($linha["data_iso"] ?? "");
        if ($dataIso === "") {
            continue;
        }
        $chave = $dataIso;
        if (!isset($cache[$chave])) {
            $cache[$chave] = ["tipo_coleta" => "caminhao", "responsavel" => "—"];
            $sql = "SELECT tipo_coleta, responsavel
                    FROM agendamento_coleta_morador
                    WHERE data_coleta = ?";
            $params = [$dataIso];
            $types = "s";
            if ($idPev > 0 && ecoadm_agendamento_tem_coluna($conn, "id_pev")) {
                $sql .= " AND (id_pev IS NULL OR id_pev = 0 OR id_pev = ?)";
                $params[] = $idPev;
                $types .= "i";
            }
            $sql .= " ORDER BY FIELD(status_coleta, 'concluida', 'andamento', 'confirmado'), id_agendamento DESC LIMIT 1";
            $stmt = $conn->prepare($sql);
            if ($stmt) {
                $stmt->bind_param($types, ...$params);
                if ($stmt->execute()) {
                    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
                    if ($row) {
                        $cache[$chave] = [
                            "tipo_coleta" => (string) ($row["tipo_coleta"] ?? "caminhao"),
                            "responsavel" => trim((string) ($row["responsavel"] ?? "")) !== ""
                                ? trim((string) $row["responsavel"])
                                : "—",
                        ];
                    }
                }
                $stmt->close();
            }
        }
        $meta = $cache[$chave];
        $linha["tipo_coleta"] = $meta["tipo_coleta"];
        $nomePev = (string) ($linha["ecoponto"] ?? "");
        $respLinha = trim((string) ($linha["responsavel"] ?? ""));
        $respAg = trim((string) ($meta["responsavel"] ?? ""));
        if (!ecoadm_responsavel_parece_instituicao($respLinha, $nomePev)) {
            $linha["responsavel"] = $respLinha;
        } elseif (!ecoadm_responsavel_parece_instituicao($respAg, $nomePev)) {
            $linha["responsavel"] = $respAg;
        } else {
            $linha["responsavel"] = ecoadm_responsavel_linha_material(
                $conn,
                $idPev,
                array_merge($linha, ["nome_ponto" => $nomePev])
            );
        }
    }
    unset($linha);

    return $linhas;
}

function ecoadm_seed_relatorio_periodo(
    mysqli $conn,
    int $idPev,
    string $desde,
    string $ate
): void {
    if ($idPev <= 0 || !ecocoleta_tabela_existe($conn, "entrega")) {
        return;
    }
    if (ecoadm_contar_entregas_pev_periodo($conn, $idPev, $desde, $ate) > 0) {
        return;
    }

    ecoadm_garantir_schema_integracao($conn);

    $qU = @$conn->query(
        "SELECT id_usuario FROM usuario WHERE tipo_usuario = 'morador' ORDER BY id_usuario ASC LIMIT 1"
    );
    $uid = 0;
    if ($qU && ($row = $qU->fetch_assoc())) {
        $uid = (int) ($row["id_usuario"] ?? 0);
        $qU->free();
    }
    if ($uid <= 0) {
        return;
    }

    if (!ecocoleta_tabela_existe($conn, "material")) {
        return;
    }
    $materiais = [];
    $qM = @$conn->query("SELECT id_material, tipo_material FROM material ORDER BY id_material ASC LIMIT 6");
    if ($qM) {
        while ($m = $qM->fetch_assoc()) {
            $materiais[] = [
                "id" => (int) ($m["id_material"] ?? 0),
                "slug" => ecoadm_material_slug((string) ($m["tipo_material"] ?? "")),
            ];
        }
        $qM->free();
    }
    if ($materiais === []) {
        @$conn->query(
            "INSERT INTO material (descricao, tipo_material) VALUES
             ('Plástico', 'plastico'), ('Papel', 'papel'), ('Vidro', 'vidro'),
             ('Metal', 'metal'), ('Orgânico', 'organico')"
        );
        $qM2 = @$conn->query("SELECT id_material, tipo_material FROM material ORDER BY id_material ASC LIMIT 6");
        if ($qM2) {
            while ($m = $qM2->fetch_assoc()) {
                $materiais[] = [
                    "id" => (int) ($m["id_material"] ?? 0),
                    "slug" => ecoadm_material_slug((string) ($m["tipo_material"] ?? "")),
                ];
            }
            $qM2->free();
        }
    }
    if ($materiais === []) {
        return;
    }

    $nomePev = "EcoPonto";
    $stmtN = $conn->prepare("SELECT nome_ponto FROM ponto_entrega WHERE id_pev = ? LIMIT 1");
    if ($stmtN) {
        $stmtN->bind_param("i", $idPev);
        if ($stmtN->execute()) {
            $rowN = ecocoleta_stmt_fetch_one_assoc($stmtN);
            if ($rowN) {
                $nomePev = (string) ($rowN["nome_ponto"] ?? $nomePev);
            }
        }
        $stmtN->close();
    }

    $inicio = new DateTimeImmutable($desde);
    $fim = new DateTimeImmutable($ate);
    if ($inicio > $fim) {
        $tmp = $inicio;
        $inicio = $fim;
        $fim = $tmp;
    }
    $dias = (int) $inicio->diff($fim)->days;
    $amostras = min(12, max(4, $dias + 1));
    $pesosDemo = [
        "plastico" => 18.5,
        "papel" => 22.0,
        "vidro" => 14.0,
        "metal" => 12.5,
        "organico" => 9.0,
        "outros" => 6.0,
    ];

    for ($i = 0; $i < $amostras; $i++) {
        $mat = $materiais[$i % count($materiais)];
        $slug = $mat["slug"];
        $kg = (float) ($pesosDemo[$slug] ?? 10.0) + ($i % 3) * 2.5;
        $offset = $amostras > 1 ? (int) round(($dias / max(1, $amostras - 1)) * $i) : 0;
        $dataEntrega = $inicio->modify("+{$offset} days")->format("Y-m-d 11:30:00");
        $pontos = (int) round($kg * 10);

        $stmtE = $conn->prepare(
            "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario, id_pev)
             VALUES (?, ?, ?, ?, ?)"
        );
        if (!$stmtE) {
            continue;
        }
        $stmtE->bind_param("sdiii", $dataEntrega, $kg, $pontos, $uid, $idPev);
        if (!$stmtE->execute()) {
            $stmtE->close();
            continue;
        }
        $idEntrega = (int) $conn->insert_id;
        $stmtE->close();

        if ($idEntrega > 0 && ecocoleta_tabela_existe($conn, "item_entrega") && $mat["id"] > 0) {
            $stmtI = $conn->prepare(
                "INSERT INTO item_entrega (quantidade, peso, id_entrega, id_material)
                 VALUES (1, ?, ?, ?)"
            );
            if ($stmtI) {
                $stmtI->bind_param("dii", $kg, $idEntrega, $mat["id"]);
                @$stmtI->execute();
                $stmtI->close();
            }
        }
    }

    if (ecoadm_tabela_agendamento_operacional($conn) && ecoadm_agendamento_tem_coluna($conn, "id_pev")) {
        $stmtUp = $conn->prepare(
            "UPDATE agendamento_coleta_morador SET id_pev = ?
             WHERE (id_pev IS NULL OR id_pev = 0) AND data_coleta >= ? AND data_coleta <= ?"
        );
        if ($stmtUp) {
            $stmtUp->bind_param("iss", $idPev, $desde, $ate);
            @$stmtUp->execute();
            $stmtUp->close();
        }
    }
}

function ecoadm_montar_relatorio(
    mysqli $conn,
    int $idAdmin,
    string $periodo = "mes",
    string $materialFiltro = ""
): array {
    $ctx = ecoadm_obter_contexto($conn, $idAdmin);
    $idPev = (int) $ctx["id_pev"];
    $nomePev = (string) ($ctx["pev"]["nome_ponto"] ?? "EcoPonto parceiro");

    $periodo = trim($periodo);
    if ($periodo === "") {
        $periodo = "todos";
    }
    $intervalo = ecoadm_intervalo_periodo($periodo);
    $desde = $intervalo["desde"];
    $ate = $intervalo["ate"];

    $linhas = ecoadm_listar_linhas_materiais($conn, $idPev, $desde, $ate);
    $linhas = ecoadm_enriquecer_linhas_relatorio($conn, $idPev, $linhas);

    if ($materialFiltro !== "") {
        $linhas = array_values(array_filter(
            $linhas,
            static fn ($l) => ($l["material"] ?? "") === $materialFiltro
        ));
    }

    $agg = ecoadm_agregar_por_material($linhas);
    $totalKg = 0.0;
    foreach ($agg as $a) {
        $totalKg += (float) ($a["total_kg"] ?? 0);
    }
    $topInfo = ecoadm_resolver_material_top($agg);
    $topSlug = (string) $topInfo["top_slug"];
    $topKg = (float) $topInfo["top_kg"];

    $chartMatLabels = [];
    $chartMatValues = [];
    foreach (["plastico", "papel", "vidro", "metal", "organico", "outros"] as $slug) {
        $val = 0.0;
        foreach ($agg as $a) {
            if (($a["material"] ?? "") === $slug) {
                $val = (float) ($a["total_kg"] ?? 0);
                break;
            }
        }
        if ($val > 0 || in_array($slug, ["plastico", "papel", "vidro", "metal", "organico"], true)) {
            $chartMatLabels[] = ecoadm_material_label($slug);
            $chartMatValues[] = round($val, 1);
        }
    }

    $resumoTipo = ecoadm_resumo_coletas_periodo($conn, $idPev, $desde, $ate);
    $cam = (int) ($resumoTipo["caminhao"] ?? 0);
    $pref = (int) ($resumoTipo["prefeitura"] ?? 0);
    if ($cam + $pref === 0 && $linhas !== []) {
        foreach ($linhas as $l) {
            if (($l["tipo_coleta"] ?? "") === "prefeitura") {
                $pref++;
            } else {
                $cam++;
            }
        }
    }

    $evolucaoLabels = [];
    $evolucaoValues = [];
    $cursor = new DateTimeImmutable($desde);
    $fim = new DateTimeImmutable($ate);
    $spanDias = (int) $cursor->diff($fim)->days + 1;

    if ($spanDias > 62) {
        $mesAtual = $cursor->modify("first day of this month");
        $fimMes = $fim->modify("first day of this month");
        while ($mesAtual <= $fimMes) {
            $mesFim = $mesAtual->modify("last day of this month");
            $d0 = $mesAtual->format("Y-m-d");
            $d1 = $mesFim > $fim ? $fim->format("Y-m-d") : $mesFim->format("Y-m-d");
            $soma = 0.0;
            foreach ($linhas as $l) {
                $iso = (string) ($l["data_iso"] ?? "");
                if ($iso >= $d0 && $iso <= $d1) {
                    $soma += (float) ($l["quantidade_kg"] ?? 0);
                }
            }
            $evolucaoLabels[] = $mesAtual->format("m/Y");
            $evolucaoValues[] = round($soma, 1);
            $mesAtual = $mesAtual->modify("+1 month");
        }
    } else {
        while ($cursor <= $fim) {
            $evolucaoLabels[] = $cursor->format("d/m");
            $dia = $cursor->format("Y-m-d");
            $soma = 0.0;
            foreach ($linhas as $l) {
                if (($l["data_iso"] ?? "") === $dia) {
                    $soma += (float) ($l["quantidade_kg"] ?? 0);
                }
            }
            $evolucaoValues[] = round($soma, 1);
            $cursor = $cursor->modify("+1 day");
            if (count($evolucaoLabels) > 45) {
                break;
            }
        }
        if (count($evolucaoLabels) > 14) {
            $step = (int) ceil(count($evolucaoLabels) / 12);
            $labs = [];
            $vals = [];
            foreach ($evolucaoLabels as $idx => $lab) {
                if ($idx % $step === 0) {
                    $labs[] = $lab;
                    $vals[] = $evolucaoValues[$idx];
                }
            }
            $evolucaoLabels = $labs;
            $evolucaoValues = $vals;
        }
    }

    $detalhes = [];
    foreach ($linhas as $l) {
        $detalhes[] = [
            "data" => (string) ($l["data"] ?? "—"),
            "ecoponto" => (string) ($l["ecoponto"] ?? $nomePev),
            "material" => (string) ($l["material_label"] ?? "—"),
            "material_slug" => (string) ($l["material"] ?? ""),
            "quantidade" => (string) ($l["quantidade_fmt"] ?? "—"),
            "tipo_coleta" => ($l["tipo_coleta"] ?? "caminhao") === "prefeitura" ? "Prefeitura" : "Caminhão",
            "responsavel" => (string) ($l["responsavel"] ?? "—"),
            "periodo" => $periodo,
        ];
    }

    $taxa = $totalKg > 0
        ? (int) min(99, max(50, round(70 + ($topKg / max(1, $totalKg)) * 25)))
        : 0;

    return [
        "detalhes" => $detalhes,
        "kpis" => [
            "total_kg" => round($totalKg, 1),
            "total_fmt" => ecoadm_formatar_peso($totalKg),
            "material_top" => (string) $topInfo["top_label"],
            "material_top_slug" => (string) $topInfo["top_slug"],
            "material_top_slugs" => $topInfo["top_slugs"],
            "material_top_empate" => (bool) $topInfo["top_empate"],
            "taxa_reaproveitamento" => $taxa,
        ],
        "charts" => [
            "materiais" => [
                "labels" => $chartMatLabels,
                "values" => $chartMatValues,
            ],
            "evolucao" => [
                "labels" => $evolucaoLabels,
                "values" => $evolucaoValues,
            ],
            "tipo_coleta" => [
                "caminhao" => $cam,
                "prefeitura" => $pref,
            ],
        ],
        "periodo" => $periodo,
        "desde" => $desde,
        "ate" => $ate,
        "ecoponto" => $ctx["pev"],
        "admin" => [
            "nome" => (string) ($ctx["admin"]["nome"] ?? ""),
            "email" => (string) ($ctx["admin"]["email"] ?? ""),
            "ecoponto" => $nomePev,
        ],
    ];
}

const ECOADM_PEV_PADRAO_NOME = "EcoPonto Verde";
const ECOADM_PEV_PADRAO_CATALOG_ID = "juazeiro-centro";

function ecoadm_pev_padrao_nome(): string
{
    return ECOADM_PEV_PADRAO_NOME;
}

function ecoadm_normalizar_nome_ecoponto(string $nome): string
{
    $nome = trim($nome);
    static $aliases = [
        "EcoPonto Central" => ECOADM_PEV_PADRAO_NOME,
        "EcoPonto" => ECOADM_PEV_PADRAO_NOME,
        "EcoPonto parceiro" => ECOADM_PEV_PADRAO_NOME,
        "EcoPonto Bairro Verde" => ECOADM_PEV_PADRAO_NOME,
        "EcoPonto Juazeiro Centro" => ECOADM_PEV_PADRAO_NOME,
    ];

    if ($nome === "") {
        return ECOADM_PEV_PADRAO_NOME;
    }

    return $aliases[$nome] ?? $nome;
}

function ecoadm_pev_tem_catalogo(mysqli $conn, int $idPev): bool
{
    if ($idPev <= 0 || !ecopontos_coluna_existe($conn, "catalog_id")) {
        return $idPev > 0;
    }

    $stmt = $conn->prepare(
        "SELECT catalog_id FROM ponto_entrega WHERE id_pev = ? LIMIT 1"
    );
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param("i", $idPev);
    if (!$stmt->execute()) {
        $stmt->close();
        return false;
    }
    $catalogId = "";
    $stmt->bind_result($catalogId);
    $stmt->fetch();
    $stmt->close();

    return trim((string) $catalogId) !== "";
}

function ecoadm_resolver_pev_catalogo(mysqli $conn, string $nomeEcoponto = ""): int
{
    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return 0;
    }

    ecopontos_garantir_schema($conn);
    ecopontos_sincronizar_catalogo($conn, true);

    $nome = ecoadm_normalizar_nome_ecoponto($nomeEcoponto);

    $stmt = $conn->prepare("SELECT id_pev FROM ponto_entrega WHERE nome_ponto = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("s", $nome);
        if ($stmt->execute()) {
            $id = 0;
            $stmt->bind_result($id);
            if ($stmt->fetch() && $id > 0) {
                $stmt->close();
                return (int) $id;
            }
        }
        $stmt->close();
    }

    if (ecopontos_coluna_existe($conn, "catalog_id")) {
        foreach (ecopontos_carregar_catalogo() as $item) {
            if (!is_array($item)) {
                continue;
            }
            $itemNome = trim((string) ($item["name"] ?? ""));
            if ($itemNome !== $nome) {
                continue;
            }
            $catalogId = trim((string) ($item["id"] ?? ""));
            if ($catalogId === "") {
                continue;
            }
            $stmtC = $conn->prepare(
                "SELECT id_pev FROM ponto_entrega WHERE catalog_id = ? LIMIT 1"
            );
            if ($stmtC) {
                $stmtC->bind_param("s", $catalogId);
                if ($stmtC->execute()) {
                    $id = 0;
                    $stmtC->bind_result($id);
                    if ($stmtC->fetch() && $id > 0) {
                        $stmtC->close();
                        return (int) $id;
                    }
                }
                $stmtC->close();
            }
        }

        $catalogPadrao = ECOADM_PEV_PADRAO_CATALOG_ID;
        $stmtP = $conn->prepare(
            "SELECT id_pev FROM ponto_entrega WHERE catalog_id = ? LIMIT 1"
        );
        if ($stmtP) {
            $stmtP->bind_param("s", $catalogPadrao);
            if ($stmtP->execute()) {
                $id = 0;
                $stmtP->bind_result($id);
                if ($stmtP->fetch() && $id > 0) {
                    $stmtP->close();
                    return (int) $id;
                }
            }
            $stmtP->close();
        }
    }

    $res = @$conn->query(
        "SELECT id_pev FROM ponto_entrega
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
         ORDER BY id_pev ASC LIMIT 1"
    );
    if ($res && ($row = $res->fetch_assoc())) {
        $res->free();
        return (int) ($row["id_pev"] ?? 0);
    }

    $res2 = @$conn->query("SELECT id_pev FROM ponto_entrega ORDER BY id_pev ASC LIMIT 1");
    if ($res2 && ($row2 = $res2->fetch_assoc())) {
        $res2->free();
        return (int) ($row2["id_pev"] ?? 0);
    }

    return 0;
}

function ecoadm_vincular_admin_pev(mysqli $conn, int $idAdmin, int $idPev, string $nomeEcoponto): void
{
    if ($idAdmin <= 0 || $idPev <= 0) {
        return;
    }

    $nomePev = trim($nomeEcoponto);
    $stmtN = $conn->prepare("SELECT nome_ponto FROM ponto_entrega WHERE id_pev = ? LIMIT 1");
    if ($stmtN) {
        $stmtN->bind_param("i", $idPev);
        if ($stmtN->execute()) {
            $n = "";
            $stmtN->bind_result($n);
            if ($stmtN->fetch() && trim($n) !== "") {
                $nomePev = trim($n);
            }
        }
        $stmtN->close();
    }

    if (ecoadm_admin_tem_coluna($conn, "id_pev")) {
        $stmtUp = $conn->prepare(
            "UPDATE administrador_ecoponto SET id_pev = ?, nome_ecoponto = ? WHERE id_admin = ? LIMIT 1"
        );
        if ($stmtUp) {
            $stmtUp->bind_param("isi", $idPev, $nomePev, $idAdmin);
            $stmtUp->execute();
            $stmtUp->close();
        }
        return;
    }

    $stmtUp = $conn->prepare(
        "UPDATE administrador_ecoponto SET nome_ecoponto = ? WHERE id_admin = ? LIMIT 1"
    );
    if ($stmtUp) {
        $stmtUp->bind_param("si", $nomePev, $idAdmin);
        $stmtUp->execute();
        $stmtUp->close();
    }
}

function ecoadm_garantir_pev_demo(mysqli $conn, int $idAdmin, string $nomeEcoponto): int
{
    $idPev = 0;

    if (ecoadm_admin_tem_coluna($conn, "id_pev")) {
        $stmt = $conn->prepare(
            "SELECT id_pev FROM administrador_ecoponto WHERE id_admin = ? LIMIT 1"
        );
        if ($stmt) {
            $stmt->bind_param("i", $idAdmin);
            if ($stmt->execute()) {
                $row = ecocoleta_stmt_fetch_one_assoc($stmt);
                if ($row && !empty($row["id_pev"])) {
                    $idPev = (int) $row["id_pev"];
                }
            }
            $stmt->close();
        }
    }

    if ($idPev > 0 && !ecoadm_pev_tem_catalogo($conn, $idPev)) {
        $idPev = 0;
    }

    if ($idPev <= 0) {
        $idPev = ecoadm_resolver_pev_catalogo($conn, $nomeEcoponto);
    }

    if ($idPev > 0 && $idAdmin > 0) {
        ecoadm_vincular_admin_pev($conn, $idAdmin, $idPev, $nomeEcoponto);
    }

    return $idPev;
}

function ecoseed_pev_padrao_id(mysqli $conn): int
{
    return ecoadm_resolver_pev_catalogo($conn, ecoadm_pev_padrao_nome());
}

function ecoseed_realinhar_ecoponto_padrao(mysqli $conn): array
{
    $stats = ["entregas" => 0, "coletas_caminhao" => 0, "coletas_prefeitura" => 0];

    ecopontos_garantir_schema($conn);
    ecopontos_sincronizar_catalogo($conn, true);

    $idPev = ecoseed_pev_padrao_id($conn);
    if ($idPev <= 0) {
        return $stats;
    }

    $nomePev = ecoadm_nome_pev_por_id($conn, $idPev);

    if (ecocoleta_tabela_existe($conn, "entrega")) {
        $stmt = $conn->prepare(
            "UPDATE entrega SET id_pev = ? WHERE id_pev IS NULL OR id_pev = 0 OR id_pev != ?"
        );
        if ($stmt) {
            $stmt->bind_param("ii", $idPev, $idPev);
            if ($stmt->execute()) {
                $stats["entregas"] = max(0, $stmt->affected_rows);
            }
            $stmt->close();
        }
    }

    if (!ecoadm_tabela_agendamento_operacional($conn) || !ecoadm_agendamento_tem_coluna($conn, "id_pev")) {
        return $stats;
    }

    $respCam = ecoadm_rotulo_responsavel("caminhao", $nomePev);
    $stmtC = $conn->prepare(
        "UPDATE agendamento_coleta_morador
         SET id_pev = ?, responsavel = ?
         WHERE tipo_coleta = 'caminhao'"
    );
    if ($stmtC) {
        $stmtC->bind_param("is", $idPev, $respCam);
        if ($stmtC->execute()) {
            $stats["coletas_caminhao"] = max(0, $stmtC->affected_rows);
        }
        $stmtC->close();
    }

    $respPref = ecoadm_rotulo_responsavel("prefeitura", $nomePev);
    $stmtP = $conn->prepare(
        "UPDATE agendamento_coleta_morador
         SET id_pev = ?, responsavel = ?
         WHERE tipo_coleta = 'prefeitura' AND status_coleta != 'cancelado'"
    );
    if ($stmtP) {
        $stmtP->bind_param("is", $idPev, $respPref);
        if ($stmtP->execute()) {
            $stats["coletas_prefeitura"] = max(0, $stmtP->affected_rows);
        }
        $stmtP->close();
    }

    ecoseed_distribuir_coletas_hoje_rede($conn, $idPev);

    ecoadm_invalidar_cache_agendamento();
    return $stats;
}

function ecoseed_distribuir_coletas_hoje_rede(mysqli $conn, int $idPevPadrao): void
{
    if (
        $idPevPadrao <= 0
        || !ecoadm_tabela_agendamento_operacional($conn)
        || !ecoadm_agendamento_tem_coluna($conn, "id_pev")
    ) {
        return;
    }

    $outrosPevs = [];
    $stmtPevs = $conn->prepare(
        "SELECT id_pev FROM ponto_entrega WHERE id_pev != ? ORDER BY id_pev ASC"
    );
    if ($stmtPevs) {
        $stmtPevs->bind_param("i", $idPevPadrao);
        if ($stmtPevs->execute()) {
            foreach (ecocoleta_stmt_fetch_all_assoc($stmtPevs) as $row) {
                $id = (int) ($row["id_pev"] ?? 0);
                if ($id > 0) {
                    $outrosPevs[] = $id;
                }
            }
        }
        $stmtPevs->close();
    }
    if ($outrosPevs === []) {
        return;
    }

    $hoje = date("Y-m-d");
    $stmt = $conn->prepare(
        "SELECT id_agendamento
         FROM agendamento_coleta_morador
         WHERE data_coleta = ? AND tipo_coleta = 'caminhao'
         ORDER BY slot_ordem ASC, id_agendamento ASC"
    );
    if (!$stmt) {
        return;
    }
    $stmt->bind_param("s", $hoje);
    if (!$stmt->execute()) {
        $stmt->close();
        return;
    }

    $ids = [];
    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $ids[] = (int) ($row["id_agendamento"] ?? 0);
    }
    $stmt->close();

    $total = count($ids);
    if ($total <= 1) {
        return;
    }

    $outrosAlvo = min(5, max(2, (int) floor($total * 0.45)));
    $metaMeu = max(1, $total - $outrosAlvo);

    $upd = $conn->prepare(
        "UPDATE agendamento_coleta_morador
         SET id_pev = ?, responsavel = ?
         WHERE id_agendamento = ?"
    );
    if (!$upd) {
        return;
    }

    foreach ($ids as $idx => $idAg) {
        if ($idAg <= 0) {
            continue;
        }
        if ($idx < $metaMeu) {
            $idDestino = $idPevPadrao;
        } else {
            $idDestino = $outrosPevs[($idx - $metaMeu) % count($outrosPevs)];
        }
        $nome = ecoadm_nome_pev_por_id($conn, $idDestino);
        $resp = ecoadm_rotulo_responsavel("caminhao", $nome);
        $upd->bind_param("isi", $idDestino, $resp, $idAg);
        $upd->execute();
    }
    $upd->close();
}

function ecoadm_obter_contexto(mysqli $conn, int $idAdmin): array
{
    ecoadm_garantir_schema_sessao($conn);

    $cols = "id_admin, nome, email, nome_ecoponto, status";
    if (ecoadm_admin_tem_coluna($conn, "id_pev")) {
        $cols .= ", id_pev";
    }
    if (ecoadm_admin_tem_coluna($conn, "funcao")) {
        $cols .= ", funcao";
    }
    if (ecoadm_admin_tem_coluna($conn, "foto_perfil")) {
        $cols .= ", foto_perfil";
    }

    $stmt = $conn->prepare("SELECT {$cols} FROM administrador_ecoponto WHERE id_admin = ? LIMIT 1");
    if (!$stmt) {
        ecoadm_json_erro("Erro ao carregar administrador.");
    }
    $stmt->bind_param("i", $idAdmin);
    if (!$stmt->execute()) {
        $stmt->close();
        ecoadm_json_erro("Erro ao consultar administrador.");
    }
    $admin = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    if (!$admin) {
        ecoadm_json_erro("Administrador nao encontrado.");
    }

    $nomeEcoponto = (string) ($admin["nome_ecoponto"] ?? ecoadm_pev_padrao_nome());
    $idPev = ecoadm_garantir_pev_demo($conn, $idAdmin, $nomeEcoponto);

    $pev = [
        "id_pev" => $idPev,
        "nome_ponto" => ecoadm_normalizar_nome_ecoponto($nomeEcoponto),
        "endereco" => "",
        "cidade" => "",
        "capacidade_pct" => 70,
        "latitude" => null,
        "longitude" => null,
    ];

    if ($idPev > 0) {
        $colsPev = "id_pev, nome_ponto, endereco";
        if (function_exists("ecopontos_coluna_existe")) {
            if (ecopontos_coluna_existe($conn, "cidade")) {
                $colsPev .= ", cidade";
            }
            if (ecopontos_coluna_existe($conn, "capacidade_pct")) {
                $colsPev .= ", capacidade_pct";
            }
            if (ecopontos_coluna_existe($conn, "latitude")) {
                $colsPev .= ", latitude, longitude";
            }
        }
        $stmtPev = $conn->prepare(
            "SELECT {$colsPev} FROM ponto_entrega WHERE id_pev = ? LIMIT 1"
        );
        if ($stmtPev) {
            $stmtPev->bind_param("i", $idPev);
            if ($stmtPev->execute()) {
                $rowPev = ecocoleta_stmt_fetch_one_assoc($stmtPev);
                if ($rowPev) {
                    $pev = [
                        "id_pev" => (int) $rowPev["id_pev"],
                        "nome_ponto" => (string) $rowPev["nome_ponto"],
                        "endereco" => (string) ($rowPev["endereco"] ?? ""),
                        "cidade" => (string) ($rowPev["cidade"] ?? ""),
                        "capacidade_pct" => (int) ($rowPev["capacidade_pct"] ?? 70),
                        "latitude" => isset($rowPev["latitude"]) && $rowPev["latitude"] !== null
                            ? (float) $rowPev["latitude"]
                            : null,
                        "longitude" => isset($rowPev["longitude"]) && $rowPev["longitude"] !== null
                            ? (float) $rowPev["longitude"]
                            : null,
                    ];
                }
            }
            $stmtPev->close();
        }
    }

    if ($idPev > 0 && session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION["ecoponto_admin_id_pev"] = $idPev;
    }

    return [
        "admin" => $admin,
        "id_pev" => $idPev,
        "pev" => $pev,
    ];
}

function ecoadm_tabela_agendamento_operacional(mysqli $conn): bool
{
    if (!ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
        return false;
    }
    return ecoadm_agendamento_tem_coluna($conn, "status_coleta")
        && ecoadm_agendamento_tem_coluna($conn, "tipo_coleta");
}

function ecoadm_sql_filtro_pev_entrega(int $idPev, string $alias = "e"): string
{
    if ($idPev <= 0) {
        return "1=1";
    }
    return "{$alias}.id_pev = " . (int) $idPev;
}

function ecoadm_formatar_data_br(?string $ymd): string
{
    if (!$ymd || !preg_match("/^\d{4}-\d{2}-\d{2}/", $ymd)) {
        return "—";
    }
    $ts = strtotime(substr($ymd, 0, 10));
    if ($ts === false) {
        return "—";
    }
    return date("d/m/Y", $ts);
}

function ecoadm_formatar_datetime_br(?string $dt): string
{
    if (!$dt) {
        return "—";
    }
    $ts = strtotime($dt);
    if ($ts === false) {
        return ecoadm_formatar_data_br($dt);
    }
    return date("d/m/Y · H:i", $ts);
}

function ecoadm_formatar_peso(float $kg): string
{
    if ($kg >= 1000) {
        return number_format($kg / 1000, 1, ",", ".") . " ton";
    }
    if ($kg == floor($kg)) {
        return (int) $kg . " kg";
    }
    return number_format($kg, 1, ",", ".") . " kg";
}

function ecoadm_formatar_peso_coleta(float $kg): string
{
    if ($kg <= 0) {
        return "—";
    }
    if ($kg < 1) {
        return (int) round($kg * 1000) . " g";
    }
    return ecoadm_formatar_peso($kg);
}

function ecoadm_prioridade_status_coleta_painel(string $status): int
{
    $map = [
        "pendente" => 0,
        "aguardando_validacao" => 1,
        "confirmado" => 2,
        "andamento" => 3,
        "concluida" => 4,
        "cancelado" => 5,
    ];

    return $map[strtolower(trim($status))] ?? 6;
}

function ecoadm_coleta_mais_relevante_painel(array $atual, array $candidato): array
{
    $prioAtual = ecoadm_prioridade_status_coleta_painel((string) ($atual["status"] ?? ""));
    $prioNovo = ecoadm_prioridade_status_coleta_painel((string) ($candidato["status"] ?? ""));

    if ($prioNovo < $prioAtual) {
        return $candidato;
    }
    if ($prioNovo > $prioAtual) {
        return $atual;
    }

    $idAtual = (int) ($atual["id_agendamento"] ?? 0);
    $idNovo = (int) ($candidato["id_agendamento"] ?? 0);
    if ($idNovo > $idAtual) {
        return $candidato;
    }

    $dataAtual = (string) ($atual["data_coleta"] ?? "");
    $dataNovo = (string) ($candidato["data_coleta"] ?? "");
    if ($dataNovo > $dataAtual) {
        return $candidato;
    }

    return $atual;
}

function ecoadm_deduplicar_coletas_por_usuario(array $lista): array
{
    $melhorPorUsuario = [];
    $semUsuario = [];

    foreach ($lista as $item) {
        $uid = (int) ($item["id_usuario"] ?? 0);
        if ($uid <= 0) {
            $semUsuario[] = $item;
            continue;
        }
        if (!isset($melhorPorUsuario[$uid])) {
            $melhorPorUsuario[$uid] = $item;
            continue;
        }
        $melhorPorUsuario[$uid] = ecoadm_coleta_mais_relevante_painel(
            $melhorPorUsuario[$uid],
            $item
        );
    }

    $vistos = [];
    $out = [];
    foreach ($lista as $item) {
        $uid = (int) ($item["id_usuario"] ?? 0);
        if ($uid <= 0) {
            continue;
        }
        if (isset($vistos[$uid])) {
            continue;
        }
        $vistos[$uid] = true;
        $out[] = $melhorPorUsuario[$uid];
    }

    foreach ($semUsuario as $item) {
        $out[] = $item;
    }

    return $out;
}

function ecoadm_obter_id_entrega_coleta_morador(
    mysqli $conn,
    int $idPev,
    int $idUsuario,
    string $dataColeta
): int {
    if ($idUsuario <= 0 || !ecocoleta_tabela_existe($conn, "entrega")) {
        return 0;
    }

    $filtroPev = ecoadm_sql_filtro_pev_entrega($idPev, "e");
    $dataLimite = preg_match("/^\d{4}-\d{2}-\d{2}$/", $dataColeta) ? $dataColeta : date("Y-m-d");

    $sqlEnt = "SELECT e.id_entrega
               FROM entrega e
               WHERE e.id_usuario = ?
                 AND {$filtroPev}
                 AND DATE(e.data_entrega) <= ?";
    if (ecoadm_entrega_tem_coluna($conn, "status_material")) {
        $sqlEnt .= " AND e.status_material = 'recebido'";
    }
    if (ecoadm_entrega_tem_coluna($conn, "id_agendamento")) {
        $sqlEnt .= " AND e.id_agendamento IS NULL";
    }
    $sqlEnt .= " ORDER BY e.data_entrega DESC LIMIT 1";

    $stmtEnt = $conn->prepare($sqlEnt);
    if (!$stmtEnt) {
        return 0;
    }
    $stmtEnt->bind_param("is", $idUsuario, $dataLimite);
    if (!$stmtEnt->execute()) {
        $stmtEnt->close();
        return 0;
    }
    $rowEnt = ecocoleta_stmt_fetch_one_assoc($stmtEnt);
    $stmtEnt->close();

    return (int) ($rowEnt["id_entrega"] ?? 0);
}

function ecoadm_materiais_coleta_morador(
    mysqli $conn,
    int $idPev,
    int $idUsuario,
    string $dataColeta,
    int $limite = 5
): array {
    if (
        $idUsuario <= 0
        || !ecocoleta_tabela_existe($conn, "entrega")
        || !ecocoleta_tabela_existe($conn, "item_entrega")
        || !ecocoleta_tabela_existe($conn, "material")
    ) {
        return [];
    }

    $limite = max(1, min(5, $limite));
    $idEntrega = ecoadm_obter_id_entrega_coleta_morador($conn, $idPev, $idUsuario, $dataColeta);
    if ($idEntrega <= 0) {
        return [];
    }

    $stmtIt = $conn->prepare(
        "SELECT ie.peso, ie.quantidade, m.tipo_material, m.descricao
         FROM item_entrega ie
         INNER JOIN material m ON m.id_material = ie.id_material
         WHERE ie.id_entrega = ?
         ORDER BY ie.peso DESC, ie.id_item_entrega ASC
         LIMIT ?"
    );
    if (!$stmtIt) {
        return [];
    }
    $stmtIt->bind_param("ii", $idEntrega, $limite);
    if (!$stmtIt->execute()) {
        $stmtIt->close();
        return [];
    }

    $materiais = [];
    foreach (ecocoleta_stmt_fetch_all_assoc($stmtIt) as $row) {
        $peso = (float) ($row["peso"] ?? 0);
        if ($peso <= 0) {
            $peso = (float) ($row["quantidade"] ?? 0);
        }
        $slug = ecoadm_material_slug((string) ($row["tipo_material"] ?? $row["descricao"] ?? ""));
        $materiais[] = [
            "material" => $slug,
            "label" => ecoadm_material_label($slug),
            "peso_kg" => $peso,
            "peso_fmt" => ecoadm_formatar_peso_coleta($peso),
        ];
    }
    $stmtIt->close();

    return $materiais;
}

function ecoadm_anexar_materiais_coletas(mysqli $conn, int $idPev, array &$coletas): void
{
    foreach ($coletas as &$coleta) {
        $coleta["materiais"] = ecoadm_materiais_coleta_morador(
            $conn,
            $idPev,
            (int) ($coleta["id_usuario"] ?? 0),
            (string) ($coleta["data_coleta"] ?? ""),
            5
        );
    }
    unset($coleta);
}

function ecoadm_listar_coletas_ecoponto_painel(mysqli $conn, int $idPev, array $filtros): array
{
    $porPagina = 10;
    $pagina = max(1, (int) ($filtros["pagina"] ?? 1));

    $lista = ecoadm_listar_coletas($conn, $idPev, $filtros);
    $lista = ecoadm_deduplicar_coletas_por_usuario($lista);

    $total = count($lista);
    $totalPaginas = max(1, (int) ceil($total / $porPagina));
    if ($pagina > $totalPaginas) {
        $pagina = $totalPaginas;
    }

    $offset = ($pagina - 1) * $porPagina;
    $paginaItens = array_slice($lista, $offset, $porPagina);
    ecoadm_anexar_materiais_coletas($conn, $idPev, $paginaItens);

    return [
        "coletas" => $paginaItens,
        "paginacao" => [
            "total" => $total,
            "pagina" => $pagina,
            "por_pagina" => $porPagina,
            "total_paginas" => $totalPaginas,
        ],
    ];
}

function ecocoleta_usuario_tem_endereco_coleta(mysqli $conn, int $idUsuario): bool
{
    if ($idUsuario <= 0 || !ecocoleta_tabela_existe($conn, "usuario")) {
        return false;
    }

    $stmt = $conn->prepare(
        "SELECT COALESCE(NULLIF(TRIM(r.nome_rua), ''), '') AS nome_rua
         FROM usuario u
         INNER JOIN rua r ON r.id_rua = u.id_rua
         WHERE u.id_usuario = ?
           AND u.id_rua IS NOT NULL
           AND u.id_rua > 0
         LIMIT 1"
    );
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param("i", $idUsuario);
    if (!$stmt->execute()) {
        $stmt->close();
        return false;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    return trim((string) ($row["nome_rua"] ?? "")) !== "";
}

function ecoadm_listar_bairros(mysqli $conn): array
{
    $lista = [];
    $vistos = [];
    $q = @$conn->query("SELECT nome_bairro FROM bairro ORDER BY nome_bairro ASC");
    if ($q) {
        while ($row = $q->fetch_assoc()) {
            $n = ecoadm_bairro_rotulo_exibicao((string) ($row["nome_bairro"] ?? ""));
            if ($n !== "" && !isset($vistos[$n])) {
                $vistos[$n] = true;
                $lista[] = $n;
            }
        }
        $q->free();
    }
    return $lista;
}

function ecoadm_listar_coletas(mysqli $conn, int $idPev, array $filtros): array
{
    ecoadm_garantir_schema_sessao($conn);

    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return [];
    }

    $bairro = trim((string) ($filtros["bairro"] ?? ""));
    $tipo = trim((string) ($filtros["tipo"] ?? ""));
    $status = trim((string) ($filtros["status"] ?? ""));

    $joinPev = "";
    $colsPev = "";
    if (
        ecoadm_agendamento_tem_coluna($conn, "id_pev")
        && ecocoleta_tabela_existe($conn, "ponto_entrega")
    ) {
        $colsPev = "a.id_pev, COALESCE(p.nome_ponto, '') AS nome_ecoponto,";
        $joinPev = " LEFT JOIN ponto_entrega p ON p.id_pev = a.id_pev";
    }

    $colsUsuario = "u.id_usuario, u.nome AS nome_usuario";
    if (ecoadm_usuario_tem_coluna($conn, "cidade")) {
        $colsUsuario .= ", COALESCE(NULLIF(TRIM(u.cidade), ''), 'Juazeiro do Norte') AS cidade_usuario";
    } else {
        $colsUsuario .= ", 'Juazeiro do Norte' AS cidade_usuario";
    }
    if (ecoadm_usuario_tem_coluna($conn, "numero")) {
        $colsUsuario .= ", COALESCE(u.numero, '') AS numero_usuario";
    } else {
        $colsUsuario .= ", '' AS numero_usuario";
    }

    $colsPeso = "";
    if (ecoadm_agendamento_tem_coluna($conn, "peso_pendente_kg")) {
        $colsPeso = "COALESCE(a.peso_pendente_kg, 0) AS peso_pendente_kg,
            COALESCE(a.pontos_pendentes, 0) AS pontos_pendentes,
            COALESCE(a.peso_status, '') AS peso_status,";
        if (ecoadm_agendamento_tem_coluna($conn, "peso_validado_kg")) {
            $colsPeso .= " COALESCE(a.peso_validado_kg, 0) AS peso_validado_kg,";
        }
        if (ecoadm_agendamento_tem_coluna($conn, "pontos_estimados")) {
            $colsPeso .= " COALESCE(a.pontos_estimados, 0) AS pontos_estimados,";
        }
        if (ecoadm_agendamento_tem_coluna($conn, "status_validacao")) {
            $colsPeso .= " COALESCE(a.status_validacao, '') AS status_validacao,";
        }
        if (ecoadm_agendamento_tem_coluna($conn, "diferenca_percentual")) {
            $colsPeso .= " COALESCE(a.diferenca_percentual, 0) AS diferenca_percentual,";
        }
    }

    $colsTipoResiduo = "";
    if (ecoadm_agendamento_tem_coluna($conn, "tipo_residuo")) {
        $colsTipoResiduo = "COALESCE(a.tipo_residuo, '') AS tipo_residuo,";
    }

    $sql = "SELECT a.id_agendamento, a.data_coleta, a.slot_ordem,
            a.status_coleta, a.tipo_coleta, a.responsavel,
            {$colsTipoResiduo}
            {$colsPeso}
            {$colsPev}
            {$colsUsuario},
            COALESCE(r.nome_rua, '') AS nome_rua,
            COALESCE(NULLIF(TRIM(r.nome_rua), ''), '—') AS endereco,
            COALESCE(b.nome_bairro, '') AS nome_bairro
        FROM agendamento_coleta_morador a
        INNER JOIN usuario u ON u.id_usuario = a.id_usuario
        INNER JOIN rua r ON r.id_rua = u.id_rua
            AND TRIM(COALESCE(r.nome_rua, '')) <> ''
        LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
        {$joinPev}
        WHERE 1=1";

    $params = [];
    $types = "";

    if ($idPev > 0 && ecoadm_agendamento_tem_coluna($conn, "id_pev")) {
        $sql .= " AND (a.id_pev IS NULL OR a.id_pev = 0 OR a.id_pev = ?)";
        $params[] = $idPev;
        $types .= "i";
    }

    if ($idPev > 0 && ecoadm_agendamento_tem_coluna($conn, "tipo_coleta")) {
        $sql .= " AND a.tipo_coleta != 'prefeitura'";
    }

    if ($bairro !== "") {
        $sql .= " AND (b.nome_bairro = ? OR b.nome_bairro LIKE CONCAT(?, ' (%)'))";
        $params[] = $bairro;
        $params[] = $bairro;
        $types .= "ss";
    }
    if ($tipo !== "" && in_array($tipo, ["caminhao", "prefeitura"], true)) {
        $sql .= " AND a.tipo_coleta = ?";
        $params[] = $tipo;
        $types .= "s";
    }
    if (
        $status !== ""
        && in_array(
            $status,
            ["pendente", "aguardando_validacao", "confirmado", "andamento", "concluida", "cancelado"],
            true
        )
    ) {
        $sql .= " AND a.status_coleta = ?";
        $params[] = $status;
        $types .= "s";
    }

    $sql .= " ORDER BY a.data_coleta DESC, a.slot_ordem ASC LIMIT 200";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }
    if ($types !== "") {
        $stmt->bind_param($types, ...$params);
    }
    if (!$stmt->execute()) {
        $stmt->close();
        ecoadm_invalidar_cache_agendamento();
        ecoadm_garantir_schema_integracao($conn);
        return [];
    }

    $rows = ecocoleta_stmt_fetch_all_assoc($stmt);
    $stmt->close();

    $lista = [];
    foreach ($rows as $row) {
        $slot = (int) ($row["slot_ordem"] ?? 0);
        $faixa = ecocoleta_faixa_horario_coleta($slot);
        $dataColeta = (string) ($row["data_coleta"] ?? "");

        $nomeEco = (string) ($row["nome_ecoponto"] ?? "");
        $respSalvo = trim((string) ($row["responsavel"] ?? ""));
        $idAgendamento = (int) ($row["id_agendamento"] ?? 0);
        if (!ecoadm_responsavel_parece_instituicao($respSalvo, $nomeEco)) {
            $respNome = $respSalvo;
        } else {
            $equipe = ecoadm_obter_equipe_responsaveis_ordenada($conn, $idPev);
            if ($equipe !== [] && $idAgendamento > 0) {
                $respNome = $equipe[abs($idAgendamento) % count($equipe)];
            } else {
                $respNome = ecoadm_rotulo_responsavel(
                    (string) ($row["tipo_coleta"] ?? "caminhao"),
                    $nomeEco
                );
            }
        }

        $pesoPend = (float) ($row["peso_pendente_kg"] ?? 0);
        $pesoVal = (float) ($row["peso_validado_kg"] ?? 0);
        $pontosPend = (int) ($row["pontos_pendentes"] ?? 0);
        $pontosEst = (int) ($row["pontos_estimados"] ?? 0);
        $pesoStatus = (string) ($row["peso_status"] ?? "");
        $statusVal = (string) ($row["status_validacao"] ?? "");
        $diffPct = (float) ($row["diferenca_percentual"] ?? 0);

        $lista[] = [
            "id_agendamento" => $idAgendamento,
            "id_usuario" => (int) ($row["id_usuario"] ?? 0),
            "usuario" => (string) ($row["nome_usuario"] ?? "—"),
            "id_pev" => (int) ($row["id_pev"] ?? 0),
            "nome_ecoponto" => $nomeEco,
            "endereco" => (string) ($row["endereco"] ?? "—"),
            "rua" => (string) ($row["nome_rua"] ?? ""),
            "bairro" => ecoadm_bairro_rotulo_exibicao((string) ($row["nome_bairro"] ?? "")) ?: "—",
            "cidade" => (string) ($row["cidade_usuario"] ?? "Juazeiro do Norte"),
            "numero" => (string) ($row["numero_usuario"] ?? ""),
            "tipo" => (string) ($row["tipo_coleta"] ?? "caminhao"),
            "status" => (string) ($row["status_coleta"] ?? "confirmado"),
            "responsavel" => $respNome,
            "data_hora" => ecoadm_formatar_data_br($dataColeta) . " · " . $faixa,
            "data_coleta" => $dataColeta,
            "slot_ordem" => $slot,
            "faixa_horario" => $faixa,
            "peso_informado_kg" => $pesoPend > 0 ? $pesoPend : null,
            "peso_pendente_kg" => $pesoPend > 0 ? $pesoPend : null,
            "peso_validado_kg" => $pesoVal > 0 ? $pesoVal : null,
            "pontos_pendentes" => $pontosPend > 0 ? $pontosPend : null,
            "pontos_estimados" => $pontosEst > 0 ? $pontosEst : null,
            "peso_status" => $pesoStatus !== "" ? $pesoStatus : null,
            "status_validacao" => $statusVal !== "" ? $statusVal : null,
            "diferenca_percentual" => $diffPct > 0 ? $diffPct : null,
        ];
        if (isset($row["tipo_residuo"])) {
            $lista[count($lista) - 1]["tipo_residuo"] = (string) ($row["tipo_residuo"] ?? "");
        }
    }

    return $lista;
}

function ecoadm_resumo_coletas_hoje(mysqli $conn, int $idPev): array
{
    ecoadm_garantir_schema_sessao($conn);

    if ($idPev <= 0) {
        $idPev = ecoseed_pev_padrao_id($conn);
    }

    $nomePev = $idPev > 0 ? ecoadm_nome_pev_por_id($conn, $idPev) : ecoadm_pev_padrao_nome();

    $vazio = [
        "meu_ecoponto" => 0,
        "outros_ecopontos" => 0,
        "nome_ecoponto" => $nomePev,
        "caminhao" => 0,
        "prefeitura" => 0,
        "serie" => [
            "labels" => ["07h", "10h", "13h", "16h", "19h"],
            "meu" => [0, 0, 0, 0, 0],
            "outros" => [0, 0, 0, 0, 0],
            "ecoponto" => [0, 0, 0, 0, 0],
            "prefeitura" => [0, 0, 0, 0, 0],
        ],
    ];

    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return $vazio;
    }

    $hoje = date("Y-m-d");
    $temPev = ecoadm_agendamento_tem_coluna($conn, "id_pev") && $idPev > 0;

    if ($temPev) {
        $sql = "SELECT
                    SUM(CASE WHEN a.id_pev = ? THEN 1 ELSE 0 END) AS meu,
                    SUM(CASE WHEN a.id_pev IS NOT NULL AND a.id_pev > 0 AND a.id_pev != ? THEN 1 ELSE 0 END) AS outros
                FROM agendamento_coleta_morador a
                WHERE a.data_coleta = ? AND a.tipo_coleta != 'prefeitura'";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return $vazio;
        }
        $stmt->bind_param("iis", $idPev, $idPev, $hoje);
    } else {
        $sql = "SELECT COUNT(*) AS meu FROM agendamento_coleta_morador
                WHERE data_coleta = ? AND tipo_coleta != 'prefeitura'";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return $vazio;
        }
        $stmt->bind_param("s", $hoje);
    }

    if (!$stmt->execute()) {
        $stmt->close();
        return $vazio;
    }

    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    $meu = (int) ($row["meu"] ?? 0);
    $outros = $temPev ? (int) ($row["outros"] ?? 0) : 0;

    $out = $vazio;
    $out["meu_ecoponto"] = $meu;
    $out["outros_ecopontos"] = $outros;
    $out["nome_ecoponto"] = $nomePev;
    $out["caminhao"] = $meu;
    $out["prefeitura"] = $outros;

    $meuSlots = [0, 0, 0, 0, 0];
    $outrosSlots = [0, 0, 0, 0, 0];

    if ($temPev) {
        $sqlSlot = "SELECT slot_ordem,
                        SUM(CASE WHEN id_pev = ? THEN 1 ELSE 0 END) AS meu,
                        SUM(CASE WHEN id_pev IS NOT NULL AND id_pev > 0 AND id_pev != ? THEN 1 ELSE 0 END) AS outros
                    FROM agendamento_coleta_morador
                    WHERE data_coleta = ? AND tipo_coleta != 'prefeitura'
                    GROUP BY slot_ordem";
        $stmtSlot = $conn->prepare($sqlSlot);
        if ($stmtSlot) {
            $stmtSlot->bind_param("iis", $idPev, $idPev, $hoje);
            if ($stmtSlot->execute()) {
                foreach (ecocoleta_stmt_fetch_all_assoc($stmtSlot) as $slotRow) {
                    $slot = (int) ($slotRow["slot_ordem"] ?? -1);
                    if ($slot < 0 || $slot > 4) {
                        continue;
                    }
                    $meuSlots[$slot] = (int) ($slotRow["meu"] ?? 0);
                    $outrosSlots[$slot] = (int) ($slotRow["outros"] ?? 0);
                }
            }
            $stmtSlot->close();
        }
    }

    $out["serie"] = [
        "labels" => ["07h", "10h", "13h", "16h", "19h"],
        "meu" => $meuSlots,
        "outros" => $outrosSlots,
        "ecoponto" => $meuSlots,
        "prefeitura" => $outrosSlots,
    ];

    return $out;
}

function ecoadm_registrar_materiais_coleta_concluida(
    mysqli $conn,
    int $idAgendamento,
    int $idPevFallback = 0
): bool {
    ecoadm_garantir_schema_integracao($conn);

    if ($idAgendamento <= 0 || !ecocoleta_tabela_existe($conn, "entrega")) {
        return false;
    }

    if (ecoadm_entrega_tem_coluna($conn, "id_agendamento")) {
        $stmtDup = $conn->prepare(
            "SELECT id_entrega FROM entrega WHERE id_agendamento = ? LIMIT 1"
        );
        if ($stmtDup) {
            $stmtDup->bind_param("i", $idAgendamento);
            if ($stmtDup->execute() && ecocoleta_stmt_fetch_one_assoc($stmtDup)) {
                $stmtDup->close();
                return true;
            }
            $stmtDup->close();
        }
    }

    $stmtAg = $conn->prepare(
        "SELECT a.id_usuario, a.data_coleta, a.tipo_coleta, a.status_coleta,
                COALESCE(a.id_pev, 0) AS id_pev,
                COALESCE(NULLIF(TRIM(a.responsavel), ''), '') AS responsavel
         FROM agendamento_coleta_morador a
         WHERE a.id_agendamento = ? LIMIT 1"
    );
    if (!$stmtAg) {
        return false;
    }
    $stmtAg->bind_param("i", $idAgendamento);
    if (!$stmtAg->execute()) {
        $stmtAg->close();
        return false;
    }
    $ag = ecocoleta_stmt_fetch_one_assoc($stmtAg);
    $stmtAg->close();
    if (!$ag || (string) ($ag["status_coleta"] ?? "") !== "concluida") {
        return false;
    }

    $idUsuario = (int) ($ag["id_usuario"] ?? 0);
    $idPev = (int) ($ag["id_pev"] ?? 0);
    if ($idPev <= 0) {
        $idPev = $idPevFallback;
    }
    if ($idUsuario <= 0 || $idPev <= 0) {
        return false;
    }

    $dataColeta = (string) ($ag["data_coleta"] ?? date("Y-m-d"));
    $tipoColeta = (string) ($ag["tipo_coleta"] ?? "caminhao");
    $nomePev = ecoadm_nome_pev_por_id($conn, $idPev);
    $dataEntrega = $dataColeta . " 14:30:00";
    $responsavelEntrega = ecoadm_resolver_responsavel_admin(
        $conn,
        $idPev,
        (string) ($ag["responsavel"] ?? ""),
        $idAgendamento
    );

    $idEntregaOrigem = ecoadm_obter_id_entrega_coleta_morador(
        $conn,
        $idPev,
        $idUsuario,
        $dataColeta
    );
    $materiais = ecoadm_materiais_coleta_morador($conn, $idPev, $idUsuario, $dataColeta, 5);

    if ($idEntregaOrigem > 0) {
        if (ecoadm_entrega_tem_coluna($conn, "status_material")) {
            $setsUp = "status_material = 'coletado', data_entrega = ?";
            $typesUp = "s";
            $paramsUp = [$dataEntrega];
            if (ecoadm_entrega_tem_coluna($conn, "id_agendamento")) {
                $setsUp .= ", id_agendamento = ?";
                $typesUp .= "i";
                $paramsUp[] = $idAgendamento;
            }
            if (ecoadm_entrega_tem_coluna($conn, "responsavel")) {
                $setsUp .= ", responsavel = ?";
                $typesUp .= "s";
                $paramsUp[] = $responsavelEntrega;
            }
            $setsUp .= " WHERE id_entrega = ? LIMIT 1";
            $typesUp .= "i";
            $paramsUp[] = $idEntregaOrigem;
            $stmtUp = $conn->prepare("UPDATE entrega SET {$setsUp}");
            if (!$stmtUp) {
                return false;
            }
            $stmtUp->bind_param($typesUp, ...$paramsUp);
            if (!$stmtUp->execute()) {
                $stmtUp->close();
                return false;
            }
            $stmtUp->close();
            ecoadm_invalidar_cache_admin();
            return true;
        }
        return true;
    }

    if ($materiais === []) {
        return true;
    }

    $pesoTotal = 0.0;
    foreach ($materiais as $mat) {
        $pesoTotal += (float) ($mat["peso_kg"] ?? 0);
    }
    if ($pesoTotal <= 0) {
        return true;
    }

    $pontos = max(1, (int) round($pesoTotal * 10));
    $conn->begin_transaction();

    try {
        $colsColeta = "data_entrega, peso_total, pontos_gerados, id_usuario, id_pev";
        $valsColeta = "?, ?, ?, ?, ?";
        $typesColeta = "sdiii";
        $paramsColeta = [$dataEntrega, $pesoTotal, $pontos, $idUsuario, $idPev];
        if (ecoadm_entrega_tem_coluna($conn, "status_material")) {
            $colsColeta .= ", status_material";
            $valsColeta .= ", 'coletado'";
        }
        if (ecoadm_entrega_tem_coluna($conn, "id_agendamento")) {
            $colsColeta .= ", id_agendamento";
            $valsColeta .= ", ?";
            $typesColeta .= "i";
            $paramsColeta[] = $idAgendamento;
        }
        if (ecoadm_entrega_tem_coluna($conn, "responsavel")) {
            $colsColeta .= ", responsavel";
            $valsColeta .= ", ?";
            $typesColeta .= "s";
            $paramsColeta[] = $responsavelEntrega;
        }
        $stmtE = $conn->prepare(
            "INSERT INTO entrega ({$colsColeta}) VALUES ({$valsColeta})"
        );
        if (!$stmtE) {
            throw new RuntimeException("prepare entrega coleta");
        }
        $stmtE->bind_param($typesColeta, ...$paramsColeta);

        if (!$stmtE->execute()) {
            $stmtE->close();
            throw new RuntimeException("insert entrega coleta");
        }
        $idEntrega = (int) $conn->insert_id;
        $stmtE->close();

        if (
            $idEntrega > 0
            && ecocoleta_tabela_existe($conn, "item_entrega")
        ) {
            foreach ($materiais as $mat) {
                $peso = (float) ($mat["peso_kg"] ?? 0);
                if ($peso <= 0) {
                    continue;
                }
                $slug = (string) ($mat["material"] ?? "outros");
                $idMaterial = ecoadm_obter_id_material_por_slug($conn, $slug);
                if ($idMaterial <= 0) {
                    continue;
                }
                $stmtI = $conn->prepare(
                    "INSERT INTO item_entrega (quantidade, peso, id_entrega, id_material)
                     VALUES (1, ?, ?, ?)"
                );
                if (!$stmtI) {
                    throw new RuntimeException("prepare item coleta");
                }
                $stmtI->bind_param("dii", $peso, $idEntrega, $idMaterial);
                if (!$stmtI->execute()) {
                    $stmtI->close();
                    throw new RuntimeException("insert item coleta");
                }
                $stmtI->close();
            }
        }

        if (ecocoleta_usuario_tem_coluna_saldo_ecopoints($conn)) {
            $novoSync = ecocoleta_obter_saldo_calculado_entrega_resgate($conn, $idUsuario);
            $stmtUp = $conn->prepare("UPDATE usuario SET saldo_ecopoints = ? WHERE id_usuario = ?");
            if ($stmtUp) {
                $stmtUp->bind_param("ii", $novoSync, $idUsuario);
                $stmtUp->execute();
                $stmtUp->close();
            }
        }

        $conn->commit();
        ecoadm_invalidar_cache_admin();
        return true;
    } catch (Throwable $e) {
        $conn->rollback();
        return false;
    }
}

function ecoadm_atualizar_coleta(
    mysqli $conn,
    int $idAgendamento,
    array $campos
): bool {
    ecoadm_garantir_schema_sessao($conn);

    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return false;
    }

    $sets = [];
    $params = [];
    $types = "";

    $tipoResp = null;
    if (isset($campos["status"]) && in_array($campos["status"], ["pendente", "aguardando_validacao", "confirmado", "andamento", "concluida"], true)) {
        $sets[] = "status_coleta = ?";
        $params[] = $campos["status"];
        $types .= "s";
    }
    if (isset($campos["tipo"]) && in_array($campos["tipo"], ["caminhao", "prefeitura"], true)) {
        $sets[] = "tipo_coleta = ?";
        $params[] = $campos["tipo"];
        $types .= "s";
        $tipoResp = (string) $campos["tipo"];
    }
    if (isset($campos["responsavel_nome"])) {
        $respNome = mb_substr(trim((string) $campos["responsavel_nome"]), 0, 80, "UTF-8");
        if ($respNome !== "") {
            $sets[] = "responsavel = ?";
            $params[] = $respNome;
            $types .= "s";
        }
    } elseif (array_key_exists("responsavel", $campos) || $tipoResp !== null) {
        if ($tipoResp === null) {
            $stmtTipo = $conn->prepare(
                "SELECT tipo_coleta FROM agendamento_coleta_morador WHERE id_agendamento = ? LIMIT 1"
            );
            if ($stmtTipo) {
                $stmtTipo->bind_param("i", $idAgendamento);
                if ($stmtTipo->execute()) {
                    $rowTipo = ecocoleta_stmt_fetch_one_assoc($stmtTipo);
                    $tipoResp = (string) ($rowTipo["tipo_coleta"] ?? "caminhao");
                }
                $stmtTipo->close();
            }
            if ($tipoResp === null) {
                $tipoResp = "caminhao";
            }
        }
        $nomePev = "";
        if (isset($campos["nome_ecoponto"])) {
            $nomePev = trim((string) $campos["nome_ecoponto"]);
        } elseif (isset($campos["id_pev"])) {
            $nomePev = ecoadm_nome_pev_por_id($conn, (int) $campos["id_pev"]);
        } else {
            $stmtPev = $conn->prepare(
                "SELECT COALESCE(a.id_pev, 0) AS id_pev
                 FROM agendamento_coleta_morador a WHERE a.id_agendamento = ? LIMIT 1"
            );
            if ($stmtPev) {
                $stmtPev->bind_param("i", $idAgendamento);
                if ($stmtPev->execute()) {
                    $rowPev = ecocoleta_stmt_fetch_one_assoc($stmtPev);
                    $nomePev = ecoadm_nome_pev_por_id($conn, (int) ($rowPev["id_pev"] ?? 0));
                }
                $stmtPev->close();
            }
        }
        $sets[] = "responsavel = ?";
        $params[] = ecoadm_rotulo_responsavel($tipoResp, $nomePev);
        $types .= "s";
    }

    if ($sets === []) {
        return false;
    }

    $sql = "UPDATE agendamento_coleta_morador SET " . implode(", ", $sets) .
        " WHERE id_agendamento = ? LIMIT 1";
    $params[] = $idAgendamento;
    $types .= "i";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param($types, ...$params);
    if (!$stmt->execute()) {
        $stmt->close();
        return false;
    }
    $ok = $stmt->affected_rows > 0;
    $stmt->close();

    if (!$ok) {
        $chk = $conn->prepare(
            "SELECT id_agendamento FROM agendamento_coleta_morador WHERE id_agendamento = ? LIMIT 1"
        );
        if ($chk) {
            $chk->bind_param("i", $idAgendamento);
            if ($chk->execute() && ecocoleta_stmt_fetch_one_assoc($chk)) {
                $ok = true;
            }
            $chk->close();
        }
    }

    if ($ok && isset($campos["status"]) && $campos["status"] === "concluida") {
        $idPevConcluir = (int) ($campos["id_pev"] ?? 0);
        ecoadm_registrar_materiais_coleta_concluida($conn, $idAgendamento, $idPevConcluir);
    }

    return $ok;
}

function ecoadm_listar_moradores_coleta(mysqli $conn): array
{
    if (!ecocoleta_tabela_existe($conn, "usuario")) {
        return [];
    }

    $sql = "SELECT u.id_usuario, u.nome,
            COALESCE(b.nome_bairro, '') AS nome_bairro,
            COALESCE(NULLIF(TRIM(r.nome_rua), ''), '—') AS endereco
        FROM usuario u
        LEFT JOIN rua r ON r.id_rua = u.id_rua
        LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
        WHERE u.tipo_usuario = 'morador'
        ORDER BY u.nome ASC
        LIMIT 120";

    $lista = [];
    $res = @$conn->query($sql);
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $lista[] = [
                "id_usuario" => (int) ($row["id_usuario"] ?? 0),
                "nome" => (string) ($row["nome"] ?? "—"),
                "bairro" => ecoadm_bairro_rotulo_exibicao((string) ($row["nome_bairro"] ?? "")),
                "endereco" => (string) ($row["endereco"] ?? "—"),
            ];
        }
        $res->free();
    }

    return $lista;
}

function ecoadm_garantir_admins_ecoponto_equipe(mysqli $conn): int
{
    if (!ecocoleta_tabela_existe($conn, "administrador_ecoponto")) {
        return 0;
    }

    ecoadm_garantir_colunas_admin($conn);

    $nomePev = ecoadm_pev_padrao_nome();
    $idPev = ecoadm_resolver_pev_catalogo($conn, $nomePev);
    if ($idPev <= 0) {
        $idPev = ecoseed_pev_padrao_id($conn);
    }

    $equipe = [
        ["Ana Beatriz Lima", "ana.lima@ecoponto.ecocoleta.local", "titular"],
        ["Carlos Eduardo Souza", "carlos.souza@ecoponto.ecocoleta.local", "gestor"],
        ["Fernanda Ribeiro", "fernanda.ribeiro@ecoponto.ecocoleta.local", "operador"],
        ["João Pedro Carvalho", "joao.carvalho@ecoponto.ecocoleta.local", "operador"],
    ];

    $senhaHash = password_hash("EcoPonto@123", PASSWORD_DEFAULT);
    $criados = 0;

    foreach ($equipe as $item) {
        [$nome, $email, $funcao] = $item;
        $funcao = ecoadm_normalizar_funcao($funcao);

        $stmtChk = $conn->prepare(
            "SELECT id_admin FROM administrador_ecoponto WHERE email = ? LIMIT 1"
        );
        if (!$stmtChk) {
            continue;
        }
        $stmtChk->bind_param("s", $email);
        if (!$stmtChk->execute()) {
            $stmtChk->close();
            continue;
        }
        $row = ecocoleta_stmt_fetch_one_assoc($stmtChk);
        $stmtChk->close();

        if ($row) {
            $idAdmin = (int) ($row["id_admin"] ?? 0);
            if ($idAdmin > 0) {
                ecoadm_garantir_pev_demo($conn, $idAdmin, $nomePev);
            }
            continue;
        }

        $cols = "nome, email, senha_hash, nome_ecoponto, status";
        $placeholders = "?, ?, ?, ?, 'ativo'";
        $types = "ssss";
        $vals = [$nome, $email, $senhaHash, $nomePev];

        if (ecoadm_admin_tem_coluna($conn, "funcao")) {
            $cols .= ", funcao";
            $placeholders .= ", ?";
            $types .= "s";
            $vals[] = $funcao;
        }
        if (ecoadm_admin_tem_coluna($conn, "id_pev") && $idPev > 0) {
            $cols .= ", id_pev";
            $placeholders .= ", ?";
            $types .= "i";
            $vals[] = $idPev;
        }

        $sql = "INSERT INTO administrador_ecoponto ({$cols}) VALUES ({$placeholders})";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            continue;
        }
        $stmt->bind_param($types, ...$vals);
        if (!$stmt->execute()) {
            $stmt->close();
            continue;
        }
        $idAdmin = (int) $conn->insert_id;
        $stmt->close();

        if ($idAdmin > 0) {
            ecoadm_garantir_pev_demo($conn, $idAdmin, $nomePev);
            $criados++;
        }
    }

    return $criados;
}

function ecoadm_listar_responsaveis_sugeridos(mysqli $conn, int $idPev): array
{
    $ordenada = ecoadm_obter_equipe_responsaveis_ordenada($conn, $idPev);
    if ($ordenada !== []) {
        return $ordenada;
    }

    $nomePev = ecoadm_nome_pev_por_id($conn, $idPev);
    $nomeEco = $nomePev !== "" ? $nomePev : ecoadm_pev_padrao_nome();

    $lista = [];
    foreach (ecoadm_listar_administradores_pev($conn, $idPev, $nomeEco, 0) as $admin) {
        $nome = trim((string) ($admin["nome"] ?? ""));
        if ($nome !== "" && !in_array($nome, $lista, true)) {
            $lista[] = $nome;
        }
    }

    if (count($lista) > 1) {
        $lista = array_values(array_filter(
            $lista,
            static fn (string $n): bool => strcasecmp($n, "Administrador EcoPonto") !== 0
        ));
    }

    if ($lista !== []) {
        return $lista;
    }

    return [$nomeEco !== "" ? $nomeEco : "Ecoponto"];
}

function ecoadm_criar_agendamento_adm(mysqli $conn, int $idPev, array $dados): array
{
    ecoadm_garantir_schema_sessao($conn);

    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return ["sucesso" => false, "erro" => "Modulo de agendamentos indisponivel."];
    }

    $idUsuario = (int) ($dados["id_usuario"] ?? 0);
    $dataColeta = trim((string) ($dados["data_coleta"] ?? ""));
    $slot = (int) ($dados["slot_ordem"] ?? 0);
    $tipo = trim((string) ($dados["tipo"] ?? "caminhao"));
    $status = trim((string) ($dados["status"] ?? "confirmado"));

    if ($idUsuario <= 0) {
        return ["sucesso" => false, "erro" => "Selecione o morador."];
    }
    if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $dataColeta)) {
        return ["sucesso" => false, "erro" => "Data da coleta invalida."];
    }
    if ($slot < 0 || $slot > 4) {
        $slot = 0;
    }
    if (!in_array($tipo, ["caminhao", "prefeitura"], true)) {
        $tipo = "caminhao";
    }
    if (!in_array($status, ["confirmado", "andamento", "concluida"], true)) {
        $status = "confirmado";
    }

    $chkU = $conn->prepare("SELECT id_usuario FROM usuario WHERE id_usuario = ? AND tipo_usuario = 'morador' LIMIT 1");
    if (!$chkU) {
        return ["sucesso" => false, "erro" => "Erro ao validar morador."];
    }
    $chkU->bind_param("i", $idUsuario);
    if (!$chkU->execute() || !ecocoleta_stmt_fetch_one_assoc($chkU)) {
        $chkU->close();
        return ["sucesso" => false, "erro" => "Morador nao encontrado."];
    }
    $chkU->close();

    $cols = "id_usuario, data_coleta, slot_ordem, status_coleta, tipo_coleta";
    $vals = "?, ?, ?, ?, ?";
    $params = [$idUsuario, $dataColeta, $slot, $status, $tipo];
    $types = "isis";

    if (ecoadm_agendamento_tem_coluna($conn, "responsavel")) {
        $cols .= ", responsavel";
        $vals .= ", ?";
        $params[] = ecoadm_rotulo_responsavel($tipo, ecoadm_nome_pev_por_id($conn, $idPev));
        $types .= "s";
    }
    if ($idPev > 0 && ecoadm_agendamento_tem_coluna($conn, "id_pev")) {
        $cols .= ", id_pev";
        $vals .= ", ?";
        $params[] = $idPev;
        $types .= "i";
    }

    $sql = "INSERT INTO agendamento_coleta_morador ({$cols}) VALUES ({$vals})";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return ["sucesso" => false, "erro" => "Nao foi possivel agendar a coleta."];
    }
    $stmt->bind_param($types, ...$params);
    if (!$stmt->execute()) {
        $erro = $conn->errno === 1062
            ? "Ja existe coleta neste horario para o morador."
            : "Nao foi possivel agendar a coleta.";
        $stmt->close();
        return ["sucesso" => false, "erro" => $erro];
    }
    $id = (int) $conn->insert_id;
    $stmt->close();

    if ($id > 0) {
        $idAdminSess = 0;
        if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION["ecoponto_admin_id"])) {
            $idAdminSess = (int) $_SESSION["ecoponto_admin_id"];
        }
        ecocoleta_notif_agendamento_para_admins(
            $conn,
            $id,
            $idUsuario,
            $dataColeta,
            $slot,
            $idAdminSess
        );
    }

    return ["sucesso" => true, "id_agendamento" => $id];
}

function ecoadm_coleta_por_id(mysqli $conn, int $idAgendamento): ?array
{
    $lista = ecoadm_listar_coletas($conn, 0, []);
    foreach ($lista as $c) {
        if ((int) ($c["id_agendamento"] ?? 0) === $idAgendamento) {
            return $c;
        }
    }
    return null;
}

function ecoadm_obter_id_material_por_slug(mysqli $conn, string $slug): int
{
    $slug = ecoadm_material_slug($slug);
    if (!ecocoleta_tabela_existe($conn, "material")) {
        return 0;
    }

    $res = @$conn->query("SELECT id_material, tipo_material, descricao FROM material ORDER BY id_material ASC");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $tipo = ecoadm_material_slug((string) ($row["tipo_material"] ?? $row["descricao"] ?? ""));
            if ($tipo === $slug) {
                $res->free();
                return (int) ($row["id_material"] ?? 0);
            }
        }
        $res->free();
    }

    $descricao = ecoadm_material_label($slug);
    $tipoDb = $slug;
    $stmt = $conn->prepare("INSERT INTO material (descricao, tipo_material) VALUES (?, ?)");
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("ss", $descricao, $tipoDb);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $id = (int) $conn->insert_id;
    $stmt->close();

    return $id;
}

function ecoadm_registrar_material_entrega(mysqli $conn, int $idPev, array $dados): array
{
    if ($idPev <= 0) {
        return ["sucesso" => false, "erro" => "EcoPonto invalido."];
    }
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return ["sucesso" => false, "erro" => "Modulo de entregas indisponivel."];
    }

    $slug = ecoadm_material_slug((string) ($dados["material"] ?? ""));
    $permitidos = ["plastico", "papel", "vidro", "metal", "organico", "madeira", "eletronicos", "outros"];
    if (!in_array($slug, $permitidos, true)) {
        return ["sucesso" => false, "erro" => "Tipo de material invalido."];
    }

    $peso = (float) str_replace(",", ".", (string) ($dados["peso_kg"] ?? "0"));
    if ($peso <= 0 || $peso > 99999) {
        return ["sucesso" => false, "erro" => "Informe um peso (kg) valido maior que zero."];
    }

    $idUsuario = (int) ($dados["id_usuario"] ?? 0);
    if ($idUsuario <= 0) {
        $moradores = ecoadm_listar_moradores_coleta($conn);
        $idUsuario = (int) ($moradores[0]["id_usuario"] ?? 0);
    }
    if ($idUsuario <= 0) {
        return ["sucesso" => false, "erro" => "Selecione o morador vinculado a entrega."];
    }

    $stmtU = $conn->prepare(
        "SELECT id_usuario, COALESCE(NULLIF(TRIM(nome), ''), 'Morador') AS nome
         FROM usuario WHERE id_usuario = ? AND tipo_usuario = 'morador' LIMIT 1"
    );
    if (!$stmtU) {
        return ["sucesso" => false, "erro" => "Nao foi possivel validar o morador."];
    }
    $stmtU->bind_param("i", $idUsuario);
    if (!$stmtU->execute()) {
        $stmtU->close();
        return ["sucesso" => false, "erro" => "Morador nao encontrado."];
    }
    $rowU = ecocoleta_stmt_fetch_one_assoc($stmtU);
    $stmtU->close();
    if (!$rowU) {
        return ["sucesso" => false, "erro" => "Morador nao encontrado."];
    }
    $nomeMorador = (string) ($rowU["nome"] ?? "Morador");

    $dataRaw = trim((string) ($dados["data_entrega"] ?? ""));
    if ($dataRaw !== "" && preg_match("/^\d{4}-\d{2}-\d{2}$/", $dataRaw)) {
        $dataEntrega = $dataRaw . " 12:00:00";
    } else {
        $dataEntrega = date("Y-m-d H:i:s");
    }

    $idMaterial = ecoadm_obter_id_material_por_slug($conn, $slug);
    if ($idMaterial <= 0) {
        return ["sucesso" => false, "erro" => "Cadastro de materiais indisponivel."];
    }

    $pontos = max(1, (int) round($peso * 10));
    $nomePev = "EcoPonto";
    $stmtP = $conn->prepare(
        "SELECT COALESCE(NULLIF(TRIM(nome_ponto), ''), 'EcoPonto') AS nome_ponto
         FROM ponto_entrega WHERE id_pev = ? LIMIT 1"
    );
    if ($stmtP) {
        $stmtP->bind_param("i", $idPev);
        if ($stmtP->execute()) {
            $rowP = ecocoleta_stmt_fetch_one_assoc($stmtP);
            if ($rowP) {
                $nomePev = (string) ($rowP["nome_ponto"] ?? $nomePev);
            }
        }
        $stmtP->close();
    }

    $filtroPev = ecoadm_sql_filtro_pev_entrega($idPev, "e");
    $indiceRodizio = 0;
    $resCnt = @$conn->query("SELECT COUNT(*) AS c FROM entrega e WHERE {$filtroPev}");
    if ($resCnt) {
        $rowCnt = $resCnt->fetch_assoc();
        $indiceRodizio = (int) ($rowCnt["c"] ?? 0);
        $resCnt->free();
    }
    $responsavel = ecoadm_resolver_responsavel_admin(
        $conn,
        $idPev,
        (string) ($dados["responsavel"] ?? ""),
        $indiceRodizio
    );

    $conn->begin_transaction();

    try {
        $colsEnt = "data_entrega, peso_total, pontos_gerados, id_usuario, id_pev";
        $valsEnt = "?, ?, ?, ?, ?";
        $typesEnt = "sdiii";
        $paramsEnt = [$dataEntrega, $peso, $pontos, $idUsuario, $idPev];
        if (ecoadm_entrega_tem_coluna($conn, "status_material")) {
            $colsEnt .= ", status_material";
            $valsEnt .= ", 'recebido'";
        }
        if (ecoadm_entrega_tem_coluna($conn, "responsavel")) {
            $colsEnt .= ", responsavel";
            $valsEnt .= ", ?";
            $typesEnt .= "s";
            $paramsEnt[] = $responsavel;
        }
        $stmtE = $conn->prepare(
            "INSERT INTO entrega ({$colsEnt}) VALUES ({$valsEnt})"
        );
        if (!$stmtE) {
            throw new RuntimeException("prepare entrega");
        }
        $stmtE->bind_param($typesEnt, ...$paramsEnt);
        if (!$stmtE->execute()) {
            throw new RuntimeException("insert entrega");
        }
        $idEntrega = (int) $conn->insert_id;
        $stmtE->close();

        if (
            $idEntrega > 0
            && ecocoleta_tabela_existe($conn, "item_entrega")
        ) {
            $stmtI = $conn->prepare(
                "INSERT INTO item_entrega (quantidade, peso, id_entrega, id_material)
                 VALUES (1, ?, ?, ?)"
            );
            if (!$stmtI) {
                throw new RuntimeException("prepare item");
            }
            $stmtI->bind_param("dii", $peso, $idEntrega, $idMaterial);
            if (!$stmtI->execute()) {
                $stmtI->close();
                throw new RuntimeException("insert item");
            }
            $stmtI->close();
        }

        if (ecocoleta_usuario_tem_coluna_saldo_ecopoints($conn)) {
            $novoSync = ecocoleta_obter_saldo_calculado_entrega_resgate($conn, $idUsuario);
            $stmtUp = $conn->prepare("UPDATE usuario SET saldo_ecopoints = ? WHERE id_usuario = ?");
            if ($stmtUp) {
                $stmtUp->bind_param("ii", $novoSync, $idUsuario);
                $stmtUp->execute();
                $stmtUp->close();
            }
        }

        $conn->commit();
        ecoadm_invalidar_cache_admin();

        $linha = [
            "id_entrega" => $idEntrega,
            "material" => $slug,
            "material_label" => ecoadm_material_label($slug),
            "quantidade_kg" => $peso,
            "quantidade_fmt" => ecoadm_formatar_peso($peso),
            "ecoponto" => $nomePev,
            "usuario" => $nomeMorador,
            "data" => ecoadm_formatar_data_br($dataEntrega),
            "data_iso" => substr($dataEntrega, 0, 10),
            "status" => "recebido",
            "responsavel" => $responsavel,
            "tipo_coleta" => "manual",
        ];

        return [
            "sucesso" => true,
            "id_entrega" => $idEntrega,
            "linha" => $linha,
            "mensagem" => "Material registrado com sucesso.",
        ];
    } catch (Throwable $e) {
        $conn->rollback();
        return ["sucesso" => false, "erro" => "Nao foi possivel registrar o material."];
    }
}

function ecoadm_listar_linhas_materiais(
    mysqli $conn,
    int $idPev,
    string $desde,
    string $ate
): array {
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return [];
    }

    if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $desde)) {
        $desde = date("Y-m-d", strtotime("-30 days"));
    }
    if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $ate)) {
        $ate = date("Y-m-d");
    }
    if ($desde > $ate) {
        $tmp = $desde;
        $desde = $ate;
        $ate = $tmp;
    }

    $filtroPev = ecoadm_sql_filtro_pev_entrega($idPev, "e");
    $linhas = [];

    if (
        ecocoleta_tabela_existe($conn, "item_entrega")
        && ecocoleta_tabela_existe($conn, "material")
    ) {
        $colsStatus = ecoadm_entrega_tem_coluna($conn, "status_material")
            ? ", e.status_material"
            : "";
        $colsResp = ecoadm_entrega_tem_coluna($conn, "responsavel")
            ? ", COALESCE(NULLIF(TRIM(e.responsavel), ''), '') AS responsavel_entrega"
            : "";
        $sqlItens = "SELECT e.id_entrega, e.data_entrega, e.peso_total{$colsStatus}{$colsResp},
                ie.peso, ie.quantidade,
                m.tipo_material, m.descricao,
                COALESCE(p.nome_ponto, 'EcoPonto') AS nome_ponto,
                COALESCE(NULLIF(TRIM(u.nome), ''), '—') AS nome_usuario
            FROM entrega e
            INNER JOIN item_entrega ie ON ie.id_entrega = e.id_entrega
            INNER JOIN material m ON m.id_material = ie.id_material
            LEFT JOIN ponto_entrega p ON p.id_pev = e.id_pev
            LEFT JOIN usuario u ON u.id_usuario = e.id_usuario
            WHERE {$filtroPev}
              AND DATE(e.data_entrega) >= ?
              AND DATE(e.data_entrega) <= ?
            ORDER BY e.data_entrega DESC
            LIMIT 300";

        $stmt = $conn->prepare($sqlItens);
        if ($stmt) {
            $stmt->bind_param("ss", $desde, $ate);
            if ($stmt->execute()) {
                foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
                    $peso = (float) ($row["peso"] ?? 0);
                    if ($peso <= 0) {
                        $peso = (float) ($row["quantidade"] ?? 0);
                    }
                    $slug = ecoadm_material_slug((string) ($row["tipo_material"] ?? $row["descricao"] ?? ""));
                    $linhas[] = [
                        "id_entrega" => (int) $row["id_entrega"],
                        "material" => $slug,
                        "material_label" => ecoadm_material_label($slug),
                        "quantidade_kg" => $peso,
                        "quantidade_fmt" => ecoadm_formatar_peso($peso),
                        "ecoponto" => (string) ($row["nome_ponto"] ?? "EcoPonto"),
                        "usuario" => (string) ($row["nome_usuario"] ?? "—"),
                        "data" => ecoadm_formatar_data_br((string) ($row["data_entrega"] ?? "")),
                        "data_iso" => substr((string) ($row["data_entrega"] ?? ""), 0, 10),
                        "status" => ecoadm_status_linha_material($row),
                        "responsavel" => ecoadm_responsavel_linha_material($conn, $idPev, $row),
                        "tipo_coleta" => "caminhao",
                    ];
                }
            }
            $stmt->close();
        }
    }

    if ($linhas !== []) {
        return $linhas;
    }

    $colsStatusEnt = ecoadm_entrega_tem_coluna($conn, "status_material")
        ? ", e.status_material"
        : "";
    $colsRespEnt = ecoadm_entrega_tem_coluna($conn, "responsavel")
        ? ", COALESCE(NULLIF(TRIM(e.responsavel), ''), '') AS responsavel_entrega"
        : "";
    $sqlEnt = "SELECT e.id_entrega, e.data_entrega, e.peso_total{$colsStatusEnt}{$colsRespEnt},
            COALESCE(p.nome_ponto, 'EcoPonto') AS nome_ponto,
            COALESCE(NULLIF(TRIM(u.nome), ''), '—') AS nome_usuario
        FROM entrega e
        LEFT JOIN ponto_entrega p ON p.id_pev = e.id_pev
        LEFT JOIN usuario u ON u.id_usuario = e.id_usuario
        WHERE {$filtroPev}
          AND DATE(e.data_entrega) >= ?
          AND DATE(e.data_entrega) <= ?
        ORDER BY e.data_entrega DESC
        LIMIT 200";

    $stmtE = $conn->prepare($sqlEnt);
    if (!$stmtE) {
        return [];
    }
    $stmtE->bind_param("ss", $desde, $ate);
    if (!$stmtE->execute()) {
        $stmtE->close();
        return [];
    }

    foreach (ecocoleta_stmt_fetch_all_assoc($stmtE) as $row) {
        $peso = (float) ($row["peso_total"] ?? 0);
        if ($peso <= 0) {
            continue;
        }
        $linhas[] = [
            "id_entrega" => (int) $row["id_entrega"],
            "material" => "outros",
            "material_label" => "Recicláveis",
            "quantidade_kg" => $peso,
            "quantidade_fmt" => ecoadm_formatar_peso($peso),
            "ecoponto" => (string) ($row["nome_ponto"] ?? "EcoPonto"),
            "usuario" => (string) ($row["nome_usuario"] ?? "—"),
            "data" => ecoadm_formatar_data_br((string) ($row["data_entrega"] ?? "")),
            "data_iso" => substr((string) ($row["data_entrega"] ?? ""), 0, 10),
            "status" => ecoadm_status_linha_material($row),
            "responsavel" => ecoadm_responsavel_linha_material($conn, $idPev, $row),
            "tipo_coleta" => "caminhao",
        ];
    }
    $stmtE->close();

    return $linhas;
}

function ecoadm_agregar_por_material(array $linhas): array
{
    $agg = [];
    foreach ($linhas as $linha) {
        $slug = (string) ($linha["material"] ?? "outros");
        if (!isset($agg[$slug])) {
            $agg[$slug] = [
                "material" => $slug,
                "label" => ecoadm_material_label($slug),
                "total_kg" => 0.0,
            ];
        }
        $agg[$slug]["total_kg"] += (float) ($linha["quantidade_kg"] ?? 0);
    }
    return array_values($agg);
}

function ecoadm_resolver_material_top(array $agg): array
{
    $topKg = 0.0;
    foreach ($agg as $a) {
        $kg = (float) ($a["total_kg"] ?? 0);
        if ($kg > $topKg) {
            $topKg = $kg;
        }
    }

    $topSlugs = [];
    if ($topKg > 0) {
        foreach ($agg as $a) {
            $kg = (float) ($a["total_kg"] ?? 0);
            if (abs($kg - $topKg) < 0.0001) {
                $slug = trim((string) ($a["material"] ?? ""));
                if ($slug !== "") {
                    $topSlugs[] = $slug;
                }
            }
        }
        $topSlugs = array_values(array_unique($topSlugs));
    }

    $empate = count($topSlugs) > 1;
    $topSlug = count($topSlugs) === 1 ? $topSlugs[0] : "";

    $labels = array_map(static fn (string $s): string => ecoadm_material_label($s), $topSlugs);
    $topLabel = $labels !== [] ? implode(", ", $labels) : "—";

    $topFmt = "—";
    if ($topKg > 0 && $labels !== []) {
        $topFmt = $topLabel . " · " . ecoadm_formatar_peso($topKg);
    }

    return [
        "top_kg" => $topKg,
        "top_slugs" => $topSlugs,
        "top_slug" => $topSlug,
        "top_empate" => $empate,
        "top_label" => $topLabel,
        "top_fmt" => $topFmt,
    ];
}

function ecoadm_capacidade_percentual(int $idPev, float $kgMes, ?int $capacidadePctPev = null): int
{
    if ($capacidadePctPev !== null && $capacidadePctPev > 0) {
        return (int) min(100, max(0, $capacidadePctPev));
    }
    if ($kgMes <= 0) {
        return 12;
    }
    $cap = 5000.0;
    return (int) min(100, max(8, round(($kgMes / $cap) * 100)));
}

function ecoadm_montar_dashboard(mysqli $conn, int $idAdmin, ?array $ctx = null): array
{
    if ($ctx === null) {
        $ctx = ecoadm_obter_contexto($conn, $idAdmin);
    }
    $idPev = (int) ($ctx["id_pev"] ?? 0);
    $pev = $ctx["pev"] ?? [];
    $hoje = date("Y-m-d");
    $mes = ecoadm_intervalo_periodo("mes");

    $coletasHoje = ecoadm_resumo_coletas_hoje($conn, $idPev);
    $totalHoje = $coletasHoje["caminhao"] + $coletasHoje["prefeitura"];

    $linhasMes = ecoadm_listar_linhas_materiais($conn, $idPev, $mes["desde"], $mes["ate"]);
    $kgMes = 0.0;
    foreach ($linhasMes as $l) {
        $kgMes += (float) ($l["quantidade_kg"] ?? 0);
    }

    $capPctPev = (int) ($pev["capacidade_pct"] ?? 0);
    $capacidade = ecoadm_capacidade_percentual($idPev, $kgMes, $capPctPev > 0 ? $capPctPev : null);
    $aggMat = ecoadm_agregar_por_material($linhasMes);

    $chartMateriais = [
        "labels" => [],
        "values" => [],
    ];
    foreach (["plastico", "papel", "vidro", "metal", "organico"] as $slug) {
        $found = null;
        foreach ($aggMat as $a) {
            if ($a["material"] === $slug) {
                $found = $a;
                break;
            }
        }
        $chartMateriais["labels"][] = ecoadm_material_label($slug);
        $chartMateriais["values"][] = $found ? (float) $found["total_kg"] : 0.0;
    }

    $agendadas = ecoadm_listar_coletas($conn, $idPev, []);
    $proximas = [];
    foreach ($agendadas as $c) {
        if ((string) ($c["data_coleta"] ?? "") >= $hoje) {
            $proximas[] = $c;
        }
        if (count($proximas) >= 8) {
            break;
        }
    }

    $materiaisAceitos = $idPev > 0
        ? ecoponto_sincronizar_materiais_pev($conn, $idPev)
        : [];

    return [
        "materiais_aceitos" => $materiaisAceitos,
        "ecoponto" => [
            "nome" => (string) $pev["nome_ponto"],
            "endereco" => (string) $pev["endereco"],
            "cidade" => (string) ($pev["cidade"] ?? ""),
            "latitude" => isset($pev["latitude"]) && $pev["latitude"] !== null
                ? (float) $pev["latitude"] : null,
            "longitude" => isset($pev["longitude"]) && $pev["longitude"] !== null
                ? (float) $pev["longitude"] : null,
            "status" => "ativo",
            "capacidade_percent" => $capacidade,
            "materiais_aceitos" => $materiaisAceitos,
        ],
        "kpis" => [
            "coletas_hoje" => $totalHoje,
            "coletas_hoje_meta" => max(20, $totalHoje + 5),
            "capacidade_percent" => $capacidade,
            "materiais_kg_mes" => round($kgMes, 1),
            "status_ecoponto" => "Ativo",
        ],
        "chart_coleta_hoje" => [
            "caminhao" => (int) $coletasHoje["caminhao"],
            "prefeitura" => (int) $coletasHoje["prefeitura"],
        ],
        "chart_materiais" => $chartMateriais,
        "coletas_agendadas" => $proximas,
        "bairros" => ecoadm_listar_bairros($conn),
    ];
}

function ecoadm_seed_dados_demo(mysqli $conn, int $idPev): void
{
    if ($idPev <= 0) {
        return;
    }

    ecoadm_garantir_schema_integracao($conn);

    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return;
    }

    $q = @$conn->query("SELECT COUNT(*) AS c FROM agendamento_coleta_morador");
    $totalAg = 0;
    if ($q) {
        $row = $q->fetch_assoc();
        $totalAg = (int) ($row["c"] ?? 0);
        $q->free();
    }
    if ($totalAg > 0) {
        return;
    }

    $qU = @$conn->query(
        "SELECT id_usuario FROM usuario WHERE tipo_usuario = 'morador' ORDER BY id_usuario ASC LIMIT 5"
    );
    $usuarios = [];
    if ($qU) {
        while ($row = $qU->fetch_assoc()) {
            $usuarios[] = (int) $row["id_usuario"];
        }
        $qU->free();
    }
    if ($usuarios === []) {
        return;
    }

    $hoje = date("Y-m-d");
    $ontem = date("Y-m-d", strtotime("-1 day"));
    $slots = [0, 1, 2];
    $statuses = ["confirmado", "andamento", "concluida"];
    $tipos = ["caminhao", "prefeitura"];
    $nomePevSeed = ecoadm_nome_pev_por_id($conn, $idPev);

    $i = 0;
    foreach ($usuarios as $uid) {
        foreach ([$hoje, $ontem] as $data) {
            $slot = $slots[$i % count($slots)];
            $status = $statuses[$i % count($statuses)];
            $tipo = $tipos[$i % count($tipos)];
            $resp = ecoadm_rotulo_responsavel($tipo, $nomePevSeed);

            $stmt = $conn->prepare(
                "INSERT IGNORE INTO agendamento_coleta_morador
                 (id_usuario, data_coleta, slot_ordem, status_coleta, tipo_coleta, responsavel, id_pev)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            if ($stmt) {
                $stmt->bind_param("isisssi", $uid, $data, $slot, $status, $tipo, $resp, $idPev);
                @$stmt->execute();
                $stmt->close();
            }
            $i++;
        }
    }

    $qMcount = @$conn->query("SELECT COUNT(*) AS c FROM material");
    $totalMat = 0;
    if ($qMcount) {
        $row = $qMcount->fetch_assoc();
        $totalMat = (int) ($row["c"] ?? 0);
        $qMcount->free();
    }
    if ($totalMat === 0) {
        @$conn->query(
            "INSERT INTO material (descricao, tipo_material) VALUES
             ('Plástico', 'plastico'),
             ('Papel', 'papel'),
             ('Vidro', 'vidro'),
             ('Metal', 'metal'),
             ('Orgânico', 'organico')"
        );
    }

    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return;
    }

    $stmtCnt = $conn->prepare("SELECT COUNT(*) AS c FROM entrega WHERE id_pev = ?");
    $totalE = 0;
    if ($stmtCnt) {
        $stmtCnt->bind_param("i", $idPev);
        if ($stmtCnt->execute()) {
            $rowCnt = ecocoleta_stmt_fetch_one_assoc($stmtCnt);
            $totalE = (int) ($rowCnt["c"] ?? 0);
        }
        $stmtCnt->close();
    }
    if ($totalE > 0) {
        return;
    }

    $uid = $usuarios[0];
    $stmtE = $conn->prepare(
        "INSERT INTO entrega (peso_total, pontos_gerados, id_usuario, id_pev)
         VALUES (42.5, 425, ?, ?)"
    );
    if ($stmtE) {
        $stmtE->bind_param("ii", $uid, $idPev);
        if ($stmtE->execute()) {
            $idEntrega = (int) $conn->insert_id;
            $stmtE->close();

            if (ecocoleta_tabela_existe($conn, "item_entrega")) {
                $qM = @$conn->query("SELECT id_material, tipo_material FROM material LIMIT 5");
                if ($qM) {
                    while ($m = $qM->fetch_assoc()) {
                        $idMat = (int) $m["id_material"];
                        $peso = 10.0 + ($idMat % 4) * 5;
                        $stmtI = $conn->prepare(
                            "INSERT INTO item_entrega (quantidade, peso, id_entrega, id_material)
                             VALUES (1, ?, ?, ?)"
                        );
                        if ($stmtI) {
                            $stmtI->bind_param("dii", $peso, $idEntrega, $idMat);
                            @$stmtI->execute();
                            $stmtI->close();
                        }
                    }
                    $qM->free();
                }
            }
        } else {
            $stmtE->close();
        }
    }

    if (ecoadm_agendamento_tem_coluna($conn, "id_pev") && $idPev > 0) {
        @$conn->query(
            "UPDATE agendamento_coleta_morador
             SET id_pev = {$idPev}
             WHERE id_pev IS NULL OR id_pev = 0"
        );
    }
}

function ecoadm_listar_bairros_ativos_pev(mysqli $conn, int $idPev): array
{
    $lista = [];
    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return ecoadm_listar_bairros($conn);
    }

    $sql = "SELECT DISTINCT b.nome_bairro
            FROM agendamento_coleta_morador a
            INNER JOIN usuario u ON u.id_usuario = a.id_usuario
            LEFT JOIN rua r ON r.id_rua = u.id_rua
            LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
            WHERE TRIM(COALESCE(b.nome_bairro, '')) <> ''";
    $params = [];
    $types = "";

    if ($idPev > 0 && ecoadm_agendamento_tem_coluna($conn, "id_pev")) {
        $sql .= " AND (a.id_pev IS NULL OR a.id_pev = 0 OR a.id_pev = ?)";
        $params[] = $idPev;
        $types .= "i";
    }
    $sql .= " ORDER BY b.nome_bairro ASC LIMIT 40";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return ecoadm_listar_bairros($conn);
    }
    if ($types !== "") {
        $stmt->bind_param($types, ...$params);
    }
    if (!$stmt->execute()) {
        $stmt->close();
        return ecoadm_listar_bairros($conn);
    }
    $vistos = [];
    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $n = ecoadm_bairro_rotulo_exibicao((string) ($row["nome_bairro"] ?? ""));
        if ($n !== "" && !isset($vistos[$n])) {
            $vistos[$n] = true;
            $lista[] = $n;
        }
    }
    $stmt->close();

    if ($lista === []) {
        return ecoadm_listar_bairros($conn);
    }

    return $lista;
}

function ecoadm_resumo_coletas_periodo(
    mysqli $conn,
    int $idPev,
    string $desde,
    string $ate
): array {
    $out = ["caminhao" => 0, "prefeitura" => 0];
    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return $out;
    }
    if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $desde) || !preg_match("/^\d{4}-\d{2}-\d{2}$/", $ate)) {
        return $out;
    }

    $sql = "SELECT tipo_coleta, COUNT(*) AS total
            FROM agendamento_coleta_morador
            WHERE data_coleta >= ? AND data_coleta <= ?";
    $params = [$desde, $ate];
    $types = "ss";

    if ($idPev > 0 && ecoadm_agendamento_tem_coluna($conn, "id_pev")) {
        $sql .= " AND (id_pev IS NULL OR id_pev = 0 OR id_pev = ?)";
        $params[] = $idPev;
        $types .= "i";
    }
    $sql .= " GROUP BY tipo_coleta";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return $out;
    }
    $stmt->bind_param($types, ...$params);
    if (!$stmt->execute()) {
        $stmt->close();
        return $out;
    }
    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $tipo = (string) ($row["tipo_coleta"] ?? "");
        $out[$tipo] = (int) ($row["total"] ?? 0);
    }
    $stmt->close();

    return $out;
}

function ecoadm_sincronizar_pev_nome(mysqli $conn, int $idPev, string $nomePonto): void
{
    if ($idPev <= 0 || trim($nomePonto) === "" || !ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return;
    }
    $nome = mb_substr(trim($nomePonto), 0, 100, "UTF-8");
    $stmt = $conn->prepare("UPDATE ponto_entrega SET nome_ponto = ? WHERE id_pev = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("si", $nome, $idPev);
        $stmt->execute();
        $stmt->close();
    }
}

function ecoadm_listar_administradores_pev(
    mysqli $conn,
    int $idPev,
    string $nomeEcoponto,
    int $idAdminAtual
): array {
    ecoadm_garantir_schema_sessao($conn);

    $cols = "id_admin, nome, email, status";
    if (ecoadm_admin_tem_coluna($conn, "funcao")) {
        $cols .= ", funcao";
    }
    if (ecoadm_admin_tem_coluna($conn, "foto_perfil")) {
        $cols .= ", foto_perfil";
    }
    if (ecoadm_admin_tem_coluna($conn, "criado_em")) {
        $cols .= ", criado_em";
    }

    $sql = "SELECT {$cols} FROM administrador_ecoponto WHERE status = 'ativo'";
    $params = [];
    $types = "";

    if ($idPev > 0 && ecoadm_admin_tem_coluna($conn, "id_pev")) {
        $sql .= " AND id_pev = ?";
        $params[] = $idPev;
        $types .= "i";
    } elseif (trim($nomeEcoponto) !== "") {
        $sql .= " AND nome_ecoponto = ?";
        $params[] = $nomeEcoponto;
        $types .= "s";
    } else {
        $sql .= " AND id_admin = ?";
        $params[] = $idAdminAtual;
        $types .= "i";
    }
    $sql .= " ORDER BY nome ASC LIMIT 50";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }
    if ($types !== "") {
        $stmt->bind_param($types, ...$params);
    }
    if (!$stmt->execute()) {
        $stmt->close();
        return [];
    }

    $lista = [];
    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $id = (int) ($row["id_admin"] ?? 0);
        $funcao = ecoadm_admin_tem_coluna($conn, "funcao")
            ? ecoadm_normalizar_funcao((string) ($row["funcao"] ?? "gestor"))
            : "titular";
        $nome = (string) ($row["nome"] ?? "");
        $lista[] = [
            "id_admin" => $id,
            "nome" => $nome,
            "email" => (string) ($row["email"] ?? ""),
            "funcao" => $funcao,
            "funcao_label" => ecoadm_funcao_label($funcao),
            "iniciais" => mb_strtoupper(
                mb_substr(preg_replace("/\s+/", "", $nome) ?: "A", 0, 2, "UTF-8"),
                "UTF-8"
            ),
            "foto_perfil" => (string) ($row["foto_perfil"] ?? ""),
            "is_self" => $id === $idAdminAtual,
        ];
    }
    $stmt->close();

    return $lista;
}

function ecoadm_contar_admins_pev(mysqli $conn, int $idPev, string $nomeEcoponto): int
{
    if ($idPev > 0 && ecoadm_admin_tem_coluna($conn, "id_pev")) {
        $stmt = $conn->prepare(
            "SELECT COUNT(*) AS c FROM administrador_ecoponto WHERE status = 'ativo' AND id_pev = ?"
        );
        if ($stmt) {
            $stmt->bind_param("i", $idPev);
            if ($stmt->execute()) {
                $row = ecocoleta_stmt_fetch_one_assoc($stmt);
                $stmt->close();
                return (int) ($row["c"] ?? 0);
            }
            $stmt->close();
        }
    }
    $nome = trim($nomeEcoponto);
    if ($nome === "") {
        return 0;
    }
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS c FROM administrador_ecoponto WHERE status = 'ativo' AND nome_ecoponto = ?"
    );
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("s", $nome);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    return (int) ($row["c"] ?? 0);
}

function ecoadm_salvar_administrador_pev(
    mysqli $conn,
    int $idAdminAtual,
    int $idPev,
    string $nomeEcoponto,
    array $dados
): array {
    ecoadm_garantir_schema_sessao($conn);

    $idEdit = (int) ($dados["id_admin"] ?? 0);
    $nome = mb_substr(trim((string) ($dados["nome"] ?? "")), 0, 120, "UTF-8");
    $email = mb_strtolower(trim((string) ($dados["email"] ?? "")), "UTF-8");
    $funcao = ecoadm_normalizar_funcao((string) ($dados["funcao"] ?? "gestor"));
    $senha = (string) ($dados["senha"] ?? "");

    if ($nome === "" || $email === "") {
        ecoadm_json_erro("Informe nome e e-mail do administrador.");
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        ecoadm_json_erro("E-mail invalido.");
    }

    $nomeEco = trim($nomeEcoponto) !== "" ? trim($nomeEcoponto) : "EcoPonto parceiro";

    if ($idEdit > 0) {
        if ($senha !== "" && strlen($senha) < 8) {
            ecoadm_json_erro("Senha deve ter pelo menos 8 caracteres.");
        }

        $sets = ["nome = ?", "email = ?"];
        $types = "ss";
        $vals = [$nome, $email];

        if (ecoadm_admin_tem_coluna($conn, "funcao")) {
            $sets[] = "funcao = ?";
            $types .= "s";
            $vals[] = $funcao;
        }
        if ($senha !== "") {
            $sets[] = "senha_hash = ?";
            $types .= "s";
            $vals[] = password_hash($senha, PASSWORD_DEFAULT);
        }

        $sql = "UPDATE administrador_ecoponto SET " . implode(", ", $sets) .
            " WHERE id_admin = ? LIMIT 1";
        $types .= "i";
        $vals[] = $idEdit;

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            ecoadm_json_erro("Erro ao atualizar administrador.");
        }
        $bindArgs = [$types];
        foreach ($vals as $k => $_) {
            $bindArgs[] = &$vals[$k];
        }
        call_user_func_array([$stmt, "bind_param"], $bindArgs);
        if (!$stmt->execute()) {
            if ((int) $conn->errno === 1062) {
                ecoadm_json_erro("Este e-mail ja esta em uso.");
            }
            ecoadm_json_erro("Nao foi possivel atualizar o administrador.");
        }
        $stmt->close();

        return ["id_admin" => $idEdit, "mensagem" => "Administrador atualizado."];
    }

    if ($senha === "" || strlen($senha) < 8) {
        ecoadm_json_erro("Informe uma senha com pelo menos 8 caracteres para o novo administrador.");
    }

    $cols = "nome, email, senha_hash, nome_ecoponto, status";
    $placeholders = "?, ?, ?, ?, 'ativo'";
    $types = "ssss";
    $vals = [$nome, $email, password_hash($senha, PASSWORD_DEFAULT), $nomeEco];

    if (ecoadm_admin_tem_coluna($conn, "funcao")) {
        $cols .= ", funcao";
        $placeholders .= ", ?";
        $types .= "s";
        $vals[] = $funcao;
    }
    if (ecoadm_admin_tem_coluna($conn, "id_pev") && $idPev > 0) {
        $cols .= ", id_pev";
        $placeholders .= ", ?";
        $types .= "i";
        $vals[] = $idPev;
    }

    $sql = "INSERT INTO administrador_ecoponto ({$cols}) VALUES ({$placeholders})";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        ecoadm_json_erro("Erro ao criar administrador.");
    }
    $bindArgs = [$types];
    foreach ($vals as $k => $_) {
        $bindArgs[] = &$vals[$k];
    }
    call_user_func_array([$stmt, "bind_param"], $bindArgs);
    if (!$stmt->execute()) {
        if ((int) $conn->errno === 1062) {
            ecoadm_json_erro("Este e-mail ja esta cadastrado.");
        }
        ecoadm_json_erro("Nao foi possivel criar o administrador.");
    }
    $novoId = (int) $conn->insert_id;
    $stmt->close();

    return ["id_admin" => $novoId, "mensagem" => "Administrador adicionado."];
}

function ecoadm_excluir_administrador_pev(
    mysqli $conn,
    int $idAdminAtual,
    int $idPev,
    string $nomeEcoponto,
    int $idExcluir
): void {
    if ($idExcluir <= 0) {
        ecoadm_json_erro("Administrador invalido.");
    }
    if ($idExcluir === $idAdminAtual) {
        ecoadm_json_erro("Voce nao pode excluir a propria conta.");
    }

    $total = ecoadm_contar_admins_pev($conn, $idPev, $nomeEcoponto);
    if ($total <= 1) {
        ecoadm_json_erro("Nao e possivel excluir o unico administrador do EcoPonto.");
    }

    $stmt = $conn->prepare(
        "UPDATE administrador_ecoponto SET status = 'inativo' WHERE id_admin = ? LIMIT 1"
    );
    if (!$stmt) {
        ecoadm_json_erro("Erro ao excluir administrador.");
    }
    $stmt->bind_param("i", $idExcluir);
    if (!$stmt->execute() || $stmt->affected_rows < 1) {
        $stmt->close();
        ecoadm_json_erro("Administrador nao encontrado.");
    }
    $stmt->close();
}
