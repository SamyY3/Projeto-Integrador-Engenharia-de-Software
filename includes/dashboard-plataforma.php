<?php

declare(strict_types=1);

require_once __DIR__ . "/admin-ecoponto-data.php";
require_once __DIR__ . "/agendamentos-plataforma-adm-format.php";

const ECOPLAT_DASH_CORES_MATERIAIS = [
    "plastico" => "#0f6b38",
    "papel" => "#12895d",
    "vidro" => "#5eb8d4",
    "metal" => "#8a9ba8",
    "organico" => "#7a8f3e",
];

const ECOPLAT_DASH_CORES_RUAS = [
    "#0f6b38",
    "#12895d",
    "#5eb8d4",
    "#8a9ba8",
    "#7a8f3e",
    "#2dd4a8",
    "#0d9488",
    "#4ade80",
];

function ecoplat_formatar_numero_br(int $n): string
{
    return number_format($n, 0, ",", ".");
}

function ecoplat_dashboard_kpis(mysqli $conn): array
{
    $coletas = 0;
    if (ecocoleta_tabela_existe($conn, "entrega")) {
        $res = @$conn->query("SELECT COUNT(*) AS c FROM entrega");
        if ($res) {
            $row = $res->fetch_assoc();
            $coletas = (int) ($row["c"] ?? 0);
            $res->free();
        }
    }

    if (ecoadm_tabela_agendamento_operacional($conn)) {
        $resAg = @$conn->query(
            "SELECT COUNT(*) AS c FROM agendamento_coleta_morador WHERE status_coleta = 'concluida'"
        );
        if ($resAg) {
            $row = $resAg->fetch_assoc();
            $coletas += (int) ($row["c"] ?? 0);
            $resAg->free();
        }
    }

    $usuariosAtivos = 0;
    $temStatus = false;
    $resCol = @$conn->query("SHOW COLUMNS FROM usuario LIKE 'status_conta'");
    if ($resCol && $resCol->num_rows > 0) {
        $temStatus = true;
    }
    if ($resCol) {
        $resCol->free();
    }

    if ($temStatus) {
        $resU = @$conn->query(
            "SELECT COUNT(*) AS c FROM usuario WHERE status_conta = 'ativo'"
        );
    } else {
        $resU = @$conn->query(
            "SELECT COUNT(*) AS c FROM usuario WHERE tipo_usuario IN ('morador', 'cooperativa', 'admin')"
        );
    }
    if ($resU) {
        $row = $resU->fetch_assoc();
        $usuariosAtivos = (int) ($row["c"] ?? 0);
        $resU->free();
    }

    $tblPlat = @$conn->query("SHOW TABLES LIKE 'administrador_plataforma'");
    if ($tblPlat && $tblPlat->num_rows > 0) {
        $tblPlat->free();
        $resAdm = @$conn->query(
            "SELECT COUNT(*) AS c FROM administrador_plataforma WHERE status = 'ativo'"
        );
        if ($resAdm) {
            $row = $resAdm->fetch_assoc();
            $usuariosAtivos += (int) ($row["c"] ?? 0);
            $resAdm->free();
        }
    } elseif ($tblPlat) {
        $tblPlat->free();
    }

    $kgReciclavel = 0.0;
    $kgOrganico = 0.0;
    $kgTotal = 0.0;

    $intervalo = ecoadm_intervalo_periodo("ano");
    $linhas = ecoadm_listar_linhas_materiais($conn, 0, $intervalo["desde"], $intervalo["ate"]);

    foreach ($linhas as $linha) {
        $kg = (float) ($linha["quantidade_kg"] ?? 0);
        $kgTotal += $kg;
        $slug = (string) ($linha["material"] ?? "outros");
        if ($slug === "organico") {
            $kgOrganico += $kg;
        } else {
            $kgReciclavel += $kg;
        }
    }

    if ($kgTotal <= 0 && ecocoleta_tabela_existe($conn, "entrega")) {
        $resKg = @$conn->query("SELECT COALESCE(SUM(peso_total), 0) AS total FROM entrega");
        if ($resKg) {
            $row = $resKg->fetch_assoc();
            $kgTotal = (float) ($row["total"] ?? 0);
            $kgReciclavel = $kgTotal * 0.66;
            $resKg->free();
        }
    }

    $taxa = 0;
    if ($kgTotal > 0) {
        $taxa = (int) round(($kgReciclavel / $kgTotal) * 100);
    }

    return [
        "coletas" => $coletas,
        "usuarios_ativos" => $usuariosAtivos,
        "kg_reciclaveis" => (int) round($kgReciclavel > 0 ? $kgReciclavel : $kgTotal),
        "taxa_reciclagem" => max(0, min(100, $taxa)),
    ];
}

function ecoplat_dashboard_materiais_chart(mysqli $conn): array
{
    $intervalo = ecoadm_intervalo_periodo("ano");
    $linhas = ecoadm_listar_linhas_materiais($conn, 0, $intervalo["desde"], $intervalo["ate"]);
    $agg = ecoadm_agregar_por_material($linhas);

    $labels = [];
    $values = [];
    $colors = [];

    foreach (["plastico", "papel", "vidro", "metal", "organico"] as $slug) {
        $found = null;
        foreach ($agg as $a) {
            if (($a["material"] ?? "") === $slug) {
                $found = $a;
                break;
            }
        }
        $kg = $found ? (float) ($found["total_kg"] ?? 0) : 0.0;
        $labels[] = ecoadm_material_label($slug);
        $values[] = round($kg, 1);
        $colors[] = ECOPLAT_DASH_CORES_MATERIAIS[$slug] ?? "#0f6b38";
    }

    return ["labels" => $labels, "values" => $values, "colors" => $colors];
}

function ecoplat_dashboard_ranking_ruas(mysqli $conn): array
{
    if (!ecocoleta_tabela_existe($conn, "entrega") || !ecocoleta_tabela_existe($conn, "rua")) {
        return [];
    }

    $sql = "SELECT COALESCE(NULLIF(TRIM(r.nome_rua), ''), 'Outros') AS nome_rua,
                   COALESCE(SUM(e.peso_total), 0) AS peso
            FROM entrega e
            INNER JOIN usuario u ON u.id_usuario = e.id_usuario
            LEFT JOIN rua r ON r.id_rua = u.id_rua
            GROUP BY nome_rua
            HAVING peso > 0
            ORDER BY peso DESC
            LIMIT 8";

    $res = @$conn->query($sql);
    if (!$res) {
        return [];
    }

    $rows = [];
    $soma = 0.0;
    while ($row = $res->fetch_assoc()) {
        $peso = (float) ($row["peso"] ?? 0);
        $soma += $peso;
        $rows[] = [
            "nome" => (string) ($row["nome_rua"] ?? "Outros"),
            "peso" => $peso,
        ];
    }
    $res->free();

    if ($rows === []) {
        return [];
    }

    if ($soma <= 0) {
        $soma = (float) count($rows);
        foreach ($rows as &$r) {
            $r["peso"] = 1.0;
        }
        unset($r);
    }

    $out = [];
    foreach ($rows as $i => $r) {
        $pct = (int) round(($r["peso"] / $soma) * 100);
        $out[] = [
            "nome" => $r["nome"],
            "pct" => $pct,
            "cor" => ECOPLAT_DASH_CORES_RUAS[$i % count(ECOPLAT_DASH_CORES_RUAS)],
            "peso" => $r["peso"],
        ];
    }

    return $out;
}

function ecoplat_status_agendamento_ui(string $status): string
{
    $s = strtolower(trim($status));
    if ($s === "concluida") {
        return "coletado";
    }
    if (in_array($s, ["confirmado", "andamento", "cancelado"], true)) {
        return $s;
    }
    return "confirmado";
}

function ecoplat_dashboard_agendamentos_recentes(mysqli $conn, int $limite = 8): array
{
    if (!ecoadm_tabela_agendamento_operacional($conn)) {
        return [];
    }

    require_once __DIR__ . "/agendamentos-plataforma-seed.php";
    ecoagend_remover_duplicados_logicos($conn);

    $joinPev = "";
    $colsPev = "";
    if (
        ecoadm_agendamento_tem_coluna($conn, "id_pev")
        && ecocoleta_tabela_existe($conn, "ponto_entrega")
    ) {
        $colsPev = ", a.id_pev, COALESCE(p.nome_ponto, '') AS nome_ecoponto";
        $joinPev = " LEFT JOIN ponto_entrega p ON p.id_pev = a.id_pev";
    }

    $sql = "SELECT a.id_agendamento, a.data_coleta, a.slot_ordem,
            a.status_coleta, a.tipo_coleta, a.responsavel
            {$colsPev},
            u.nome AS nome_usuario,
            COALESCE(b.nome_bairro, '') AS nome_bairro
        FROM agendamento_coleta_morador a
        INNER JOIN usuario u ON u.id_usuario = a.id_usuario
        LEFT JOIN rua r ON r.id_rua = u.id_rua
        LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
        {$joinPev}
        INNER JOIN (
            SELECT MAX(id_agendamento) AS id_agendamento
            FROM agendamento_coleta_morador
            GROUP BY id_usuario, data_coleta, status_coleta, tipo_coleta"
        . (ecoadm_agendamento_tem_coluna($conn, "id_pev")
            ? ", COALESCE(id_pev, 0)"
            : "")
        . "
        ) dedup ON dedup.id_agendamento = a.id_agendamento
        ORDER BY a.data_coleta DESC, a.id_agendamento DESC
        LIMIT ?";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }

    $stmt->bind_param("i", $limite);
    if (!$stmt->execute()) {
        $stmt->close();
        return [];
    }

    $rows = ecocoleta_stmt_fetch_all_assoc($stmt);
    $stmt->close();

    $lista = [];
    foreach ($rows as $row) {
        $id = (int) ($row["id_agendamento"] ?? 0);
        $dataColeta = (string) ($row["data_coleta"] ?? "");
        $slot = (int) ($row["slot_ordem"] ?? 0);
        $dataBr = ecoadm_formatar_data_br($dataColeta);
        $faixa = ecocoleta_faixa_horario_coleta($slot);
        $horaCurta = "—";
        if (preg_match("/^(\d{2}:\d{2})/", $faixa, $m)) {
            $horaCurta = $m[1] . "h";
        }

        $itemRow = [
            "id_agendamento" => $id,
            "usuario" => (string) ($row["nome_usuario"] ?? "—"),
            "data_coleta" => $dataColeta,
            "slot_ordem" => $slot,
            "bairro" => (string) ($row["nome_bairro"] ?? "—"),
            "tipo" => (string) ($row["tipo_coleta"] ?? "caminhao"),
            "status" => (string) ($row["status_coleta"] ?? "confirmado"),
            "responsavel" => (string) ($row["responsavel"] ?? ""),
            "nome_ecoponto" => (string) ($row["nome_ecoponto"] ?? ""),
            "id_pev" => (int) ($row["id_pev"] ?? 0),
        ];

        $origem = ecoplat_rotulo_origem_agendamento($itemRow);
        $statusDb = (string) ($itemRow["status"] ?? "confirmado");

        $lista[] = [
            "id_agendamento" => $id,
            "id" => "#" . $id,
            "usuario" => (string) ($itemRow["usuario"] ?? "—"),
            "data" => trim($dataBr . " · " . $horaCurta, " ·"),
            "data_coleta" => $dataColeta,
            "ecoponto" => $origem,
            "bairro" => (string) ($itemRow["bairro"] ?? "—"),
            "status" => ecoplat_status_agendamento_ui($statusDb),
            "status_db" => $statusDb,
            "slot_ordem" => $slot,
            "tipo" => (string) ($itemRow["tipo"] ?? "caminhao"),
            "responsavel" => function_exists("ecoadm_rotulo_responsavel")
                ? ecoadm_rotulo_responsavel(
                    (string) ($itemRow["tipo"] ?? "caminhao"),
                    (string) ($itemRow["nome_ecoponto"] ?? "")
                )
                : (string) ($itemRow["responsavel"] ?? ""),
        ];
    }

    return $lista;
}

function ecoplat_montar_dashboard(mysqli $conn): array
{
    $kpis = ecoplat_dashboard_kpis($conn);
    $materiais = ecoplat_dashboard_materiais_chart($conn);
    $ruas = ecoplat_dashboard_ranking_ruas($conn);
    $agendamentos = ecoplat_dashboard_agendamentos_recentes($conn);

    $temDados = ($kpis["coletas"] ?? 0) > 0
        || array_sum($materiais["values"]) > 0
        || $ruas !== [];

    return [
        "kpis" => $kpis,
        "materiais" => $materiais,
        "ruas" => $ruas,
        "agendamentos" => $agendamentos,
        "tem_dados" => $temDados,
    ];
}

function ecoplat_dashboard_contar_entregas(mysqli $conn): int
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return 0;
    }
    $res = @$conn->query("SELECT COUNT(*) AS c FROM entrega");
    if (!$res) {
        return 0;
    }
    $row = $res->fetch_assoc();
    $res->free();
    return (int) ($row["c"] ?? 0);
}

function ecoplat_dashboard_contar_agendamentos(mysqli $conn): int
{
    if (!ecoadm_tabela_agendamento_operacional($conn)) {
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

function ecoplat_dashboard_contar_pev(mysqli $conn): int
{
    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return 0;
    }
    $res = @$conn->query("SELECT COUNT(*) AS c FROM ponto_entrega");
    if (!$res) {
        return 0;
    }
    $row = $res->fetch_assoc();
    $res->free();
    return (int) ($row["c"] ?? 0);
}

function ecoplat_dashboard_precisa_popular(mysqli $conn): bool
{
    if (ecoplat_dashboard_contar_pev($conn) <= 0) {
        return true;
    }
    if (ecoplat_dashboard_contar_entregas($conn) < 20) {
        return true;
    }
    if (ecoplat_dashboard_contar_agendamentos($conn) < 3) {
        return true;
    }
    return false;
}

function ecoplat_dashboard_garantir_dados(mysqli $conn): array
{
    require_once __DIR__ . "/ecopontos-repository.php";
    require_once __DIR__ . "/dashboard-plataforma-seed.php";
    require_once __DIR__ . "/agendamentos-plataforma-seed.php";

    ecoadm_garantir_schema_integracao($conn);
    ecopontos_garantir_schema($conn);
    ecoagend_garantir_enum_cancelado($conn);

    $ecopontos = ecopontos_sincronizar_catalogo($conn, true);
    $agendamentos = ecoagend_sincronizar_seed($conn, true);
    ecoagend_vincular_pev_existentes($conn);
    ecoagend_remover_duplicados_logicos($conn);
    $entregas = ecoplat_dashboard_sincronizar_seed($conn, false);

    return [
        "ecopontos" => $ecopontos,
        "agendamentos" => $agendamentos,
        "entregas" => $entregas,
    ];
}

function ecoplat_dashboard_payload(mysqli $conn, bool $syncSeed = false): array
{
    if ($syncSeed) {
        ecoplat_dashboard_garantir_dados($conn);
    }

    $payload = ecoplat_montar_dashboard($conn);

    $totalEntregas = ecoplat_dashboard_contar_entregas($conn);
    $totalAg = ecoplat_dashboard_contar_agendamentos($conn);
    $totalPev = ecoplat_dashboard_contar_pev($conn);

    $temDados =
        ($payload["kpis"]["coletas"] ?? 0) > 0
        || array_sum($payload["materiais"]["values"] ?? []) > 0
        || ($payload["ruas"] ?? []) !== []
        || ($payload["agendamentos"] ?? []) !== [];

    $payload["meta"] = [
        "fonte" => "banco",
        "tem_dados" => $temDados,
        "total_entregas" => $totalEntregas,
        "total_agendamentos" => $totalAg,
        "total_ecopontos" => $totalPev,
        "gerado_em" => date("c"),
    ];

    return $payload;
}
