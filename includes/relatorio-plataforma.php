<?php

declare(strict_types=1);

require_once __DIR__ . "/admin-ecoponto-data.php";

const ECOPLAT_REL_CORES_MATERIAIS = [
    "plastico" => "#1FA8C9",
    "papel" => "#5B8DEF",
    "vidro" => "#12A06A",
    "metal" => "#E5A03D",
    "organico" => "#7D9B76",
    "madeira" => "#B8834A",
    "outros" => "#9BB5A8",
];

function ecoplat_relatorio_intervalo(?string $desde, ?string $ate): array
{
    $hoje = new DateTimeImmutable("today");
    $ateOk = $ate && preg_match("/^\d{4}-\d{2}-\d{2}$/", $ate) ? $ate : $hoje->format("Y-m-d");
    $desdeOk = $desde && preg_match("/^\d{4}-\d{2}-\d{2}$/", $desde)
        ? $desde
        : $hoje->modify("first day of january")->format("Y-m-d");
    if ($desdeOk > $ateOk) {
        return ["desde" => $ateOk, "ate" => $desdeOk];
    }
    return ["desde" => $desdeOk, "ate" => $ateOk];
}

function ecoplat_relatorio_linhas_materiais(
    mysqli $conn,
    string $desde,
    string $ate,
    string $bairroFiltro = ""
): array {
    $linhas = ecoadm_listar_linhas_materiais($conn, 0, $desde, $ate);
    if ($bairroFiltro === "") {
        return $linhas;
    }

    $idsEntrega = [];
    foreach ($linhas as $l) {
        $id = (int) ($l["id_entrega"] ?? 0);
        if ($id > 0) {
            $idsEntrega[$id] = true;
        }
    }
    if ($idsEntrega === [] || !ecocoleta_tabela_existe($conn, "entrega")) {
        return [];
    }

    $idsBairroOk = [];
    $sql = "SELECT e.id_entrega
            FROM entrega e
            INNER JOIN usuario u ON u.id_usuario = e.id_usuario
            LEFT JOIN rua r ON r.id_rua = u.id_rua
            LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
            WHERE b.nome_bairro = ? AND DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?";
    $stmt = $conn->prepare($sql);
    if ($stmt) {
        $stmt->bind_param("sss", $bairroFiltro, $desde, $ate);
        if ($stmt->execute()) {
            foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
                $idsBairroOk[(int) $row["id_entrega"]] = true;
            }
        }
        $stmt->close();
    }

    return array_values(array_filter(
        $linhas,
        static fn ($l) => isset($idsBairroOk[(int) ($l["id_entrega"] ?? 0)])
    ));
}

function ecoplat_relatorio_listar_bairros(mysqli $conn): array
{
    return ecoadm_listar_bairros($conn);
}

function ecoplat_relatorio_sql_filtro_bairro(string $bairroFiltro, string $aliasEntrega = "e"): array
{
    $bairroFiltro = trim($bairroFiltro);
    if ($bairroFiltro === "") {
        return ["join" => "", "where" => "", "types" => "", "params" => []];
    }

    return [
        "join" => " INNER JOIN usuario u ON u.id_usuario = {$aliasEntrega}.id_usuario
                    LEFT JOIN rua r ON r.id_rua = u.id_rua
                    LEFT JOIN bairro b ON b.id_bairro = r.id_bairro",
        "where" => " AND b.nome_bairro = ?",
        "types" => "s",
        "params" => [$bairroFiltro],
    ];
}

function ecoplat_relatorio_agregar_meses_sql(
    mysqli $conn,
    string $desde,
    string $ate,
    string $bairroFiltro = ""
): array {
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return [];
    }

    $filtroBairro = ecoplat_relatorio_sql_filtro_bairro($bairroFiltro);
    $porMes = [];

    if (
        ecocoleta_tabela_existe($conn, "item_entrega")
        && ecocoleta_tabela_existe($conn, "material")
    ) {
        $sql = "SELECT DATE_FORMAT(e.data_entrega, '%Y-%m') AS ym,
                       SUM(COALESCE(ie.peso, ie.quantidade, 0)) AS kg
                FROM entrega e
                INNER JOIN item_entrega ie ON ie.id_entrega = e.id_entrega
                {$filtroBairro["join"]}
                WHERE DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?
                {$filtroBairro["where"]}
                GROUP BY ym
                ORDER BY ym ASC";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $types = "ss" . $filtroBairro["types"];
            $params = array_merge([$desde, $ate], $filtroBairro["params"]);
            $stmt->bind_param($types, ...$params);
            if ($stmt->execute()) {
                foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
                    $porMes[(string) ($row["ym"] ?? "")] = (float) ($row["kg"] ?? 0);
                }
            }
            $stmt->close();
        }
    }

    if ($porMes === []) {
        $sql = "SELECT DATE_FORMAT(e.data_entrega, '%Y-%m') AS ym,
                       SUM(COALESCE(e.peso_total, 0)) AS kg
                FROM entrega e
                {$filtroBairro["join"]}
                WHERE DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?
                {$filtroBairro["where"]}
                GROUP BY ym
                ORDER BY ym ASC";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $types = "ss" . $filtroBairro["types"];
            $params = array_merge([$desde, $ate], $filtroBairro["params"]);
            $stmt->bind_param($types, ...$params);
            if ($stmt->execute()) {
                foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
                    $porMes[(string) ($row["ym"] ?? "")] = (float) ($row["kg"] ?? 0);
                }
            }
            $stmt->close();
        }
    }

    return $porMes;
}

function ecoplat_relatorio_agregar_materiais_sql(
    mysqli $conn,
    string $desde,
    string $ate,
    string $bairroFiltro = ""
): array {
    $vazio = ["kg_total" => 0.0, "agg" => []];
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return $vazio;
    }

    $filtroBairro = ecoplat_relatorio_sql_filtro_bairro($bairroFiltro);
    $agg = [];
    $kgTotal = 0.0;

    if (
        ecocoleta_tabela_existe($conn, "item_entrega")
        && ecocoleta_tabela_existe($conn, "material")
    ) {
        $sql = "SELECT m.tipo_material, m.descricao,
                       SUM(COALESCE(ie.peso, ie.quantidade, 0)) AS total_kg
                FROM entrega e
                INNER JOIN item_entrega ie ON ie.id_entrega = e.id_entrega
                INNER JOIN material m ON m.id_material = ie.id_material
                {$filtroBairro["join"]}
                WHERE DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?
                {$filtroBairro["where"]}
                GROUP BY m.id_material, m.tipo_material, m.descricao";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $types = "ss" . $filtroBairro["types"];
            $params = array_merge([$desde, $ate], $filtroBairro["params"]);
            $stmt->bind_param($types, ...$params);
            if ($stmt->execute()) {
                $porSlug = [];
                foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
                    $slug = ecoadm_material_slug((string) ($row["tipo_material"] ?? $row["descricao"] ?? ""));
                    $kg = (float) ($row["total_kg"] ?? 0);
                    if (!isset($porSlug[$slug])) {
                        $porSlug[$slug] = 0.0;
                    }
                    $porSlug[$slug] += $kg;
                    $kgTotal += $kg;
                }
                foreach ($porSlug as $slug => $kg) {
                    $agg[] = ["material" => $slug, "total_kg" => $kg];
                }
            }
            $stmt->close();
        }
    }

    if ($agg === []) {
        $sql = "SELECT SUM(COALESCE(e.peso_total, 0)) AS total_kg
                FROM entrega e
                {$filtroBairro["join"]}
                WHERE DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?
                {$filtroBairro["where"]}";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $types = "ss" . $filtroBairro["types"];
            $params = array_merge([$desde, $ate], $filtroBairro["params"]);
            $stmt->bind_param($types, ...$params);
            if ($stmt->execute()) {
                $row = ecocoleta_stmt_fetch_one_assoc($stmt);
                $kgTotal = (float) ($row["total_kg"] ?? 0);
            }
            $stmt->close();
        }
    }

    return ["kg_total" => $kgTotal, "agg" => $agg];
}

function ecoplat_relatorio_agregar_meses(array $linhas): array
{
    $porMes = [];
    foreach ($linhas as $l) {
        $iso = (string) ($l["data_iso"] ?? "");
        if (!preg_match("/^(\d{4})-(\d{2})/", $iso, $m)) {
            continue;
        }
        $chave = $m[1] . "-" . $m[2];
        if (!isset($porMes[$chave])) {
            $porMes[$chave] = 0.0;
        }
        $porMes[$chave] += (float) ($l["quantidade_kg"] ?? 0);
    }
    ksort($porMes);
    return $porMes;
}

function ecoplat_relatorio_preencher_meses_intervalo(string $desde, string $ate, array $porMes): array
{
    try {
        $inicio = new DateTimeImmutable($desde);
        $fim = new DateTimeImmutable($ate);
    } catch (Throwable $e) {
        return $porMes;
    }

    $cursor = $inicio->modify("first day of this month");
    $ultimo = $fim->modify("first day of this month");
    if ($cursor > $ultimo) {
        return $porMes;
    }

    $preenchido = [];
    while ($cursor <= $ultimo) {
        $chave = $cursor->format("Y-m");
        $preenchido[$chave] = (float) ($porMes[$chave] ?? 0.0);
        $cursor = $cursor->modify("+1 month");
    }

    return $preenchido;
}

function ecoplat_relatorio_montar(
    mysqli $conn,
    ?string $desdeIn = null,
    ?string $ateIn = null,
    string $bairroFiltro = ""
): array {
    ecoadm_garantir_schema_integracao($conn);
    require_once __DIR__ . "/ecopontos-repository.php";
    ecopontos_garantir_todos_ativos($conn);

    $intervalo = ecoplat_relatorio_intervalo($desdeIn, $ateIn);
    $desde = $intervalo["desde"];
    $ate = $intervalo["ate"];

    $bairroFiltro = trim($bairroFiltro);
    $linhas = ecoplat_relatorio_linhas_materiais($conn, $desde, $ate, $bairroFiltro);

    $materiaisSql = ecoplat_relatorio_agregar_materiais_sql($conn, $desde, $ate, $bairroFiltro);
    $kgTotal = (float) ($materiaisSql["kg_total"] ?? 0);
    $agg = $materiaisSql["agg"] ?? [];
    $matLabels = [];
    $matValues = [];
    $matColors = [];
    $slugsOrdem = ["plastico", "papel", "vidro", "metal", "organico", "madeira", "outros"];
    foreach ($slugsOrdem as $slug) {
        $val = 0.0;
        foreach ($agg as $a) {
            if (($a["material"] ?? "") === $slug) {
                $val = (float) ($a["total_kg"] ?? 0);
                break;
            }
        }
        if ($val > 0 || in_array($slug, ["plastico", "papel", "vidro", "metal", "organico"], true)) {
            $matLabels[] = ecoadm_material_label($slug);
            $matValues[] = (int) round($val);
            $matColors[] = ECOPLAT_REL_CORES_MATERIAIS[$slug] ?? "#0f6b38";
        }
    }

    $kgReciclavel = 0.0;
    foreach ($agg as $a) {
        if (($a["material"] ?? "") !== "organico") {
            $kgReciclavel += (float) ($a["total_kg"] ?? 0);
        }
    }
    $totalPct = $kgTotal > 0 ? (int) min(99, round(($kgReciclavel / $kgTotal) * 100)) : 0;

    $porMes = ecoplat_relatorio_preencher_meses_intervalo(
        $desde,
        $ate,
        ecoplat_relatorio_agregar_meses_sql($conn, $desde, $ate, $bairroFiltro)
    );
    $mesLabels = [];
    $mesValues = [];
    $mesNomes = [
        "01" => "Jan", "02" => "Fev", "03" => "Mar", "04" => "Abr",
        "05" => "Mai", "06" => "Jun", "07" => "Jul", "08" => "Ago",
        "09" => "Set", "10" => "Out", "11" => "Nov", "12" => "Dez",
    ];
    foreach ($porMes as $ym => $kg) {
        $parts = explode("-", $ym);
        $mesLabels[] = $mesNomes[$parts[1] ?? "01"] ?? $ym;
        $mesValues[] = round($kg / 1000, 2);
    }

    $trendPct = 0.0;
    $keys = array_keys($porMes);
    if (count($keys) >= 2) {
        $ult = (float) $porMes[$keys[count($keys) - 1]];
        $pen = (float) $porMes[$keys[count($keys) - 2]];
        if ($pen > 0) {
            $trendPct = round((($ult - $pen) / $pen) * 100, 1);
        }
    }

    $evolucaoLabels = $mesLabels;
    $evolucaoValues = array_map(
        static fn ($v) => (int) round((float) $v * 1000),
        $mesValues
    );
    if (count($evolucaoLabels) > 8) {
        $evolucaoLabels = array_slice($evolucaoLabels, -8);
        $evolucaoValues = array_slice($evolucaoValues, -8);
    }

    $participacoes = 0;
    if (ecocoleta_tabela_existe($conn, "entrega")) {
        $sqlP = "SELECT COUNT(DISTINCT e.id_usuario) AS c FROM entrega e";
        $params = [];
        $types = "";
        $filtroBairro = ecoplat_relatorio_sql_filtro_bairro($bairroFiltro);
        $sqlP .= $filtroBairro["join"]
            . " WHERE DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?"
            . $filtroBairro["where"];
        $params = array_merge([$desde, $ate], $filtroBairro["params"]);
        $types = "ss" . $filtroBairro["types"];
        $stmtP = $conn->prepare($sqlP);
        if ($stmtP) {
            $stmtP->bind_param($types, ...$params);
            if ($stmtP->execute()) {
                $rowP = ecocoleta_stmt_fetch_one_assoc($stmtP);
                $participacoes = (int) ($rowP["c"] ?? 0);
            }
            $stmtP->close();
        }
    }

    $ecopontosAtivos = 0;
    if (ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        ecopontos_garantir_schema($conn);
        if (ecopontos_coluna_existe($conn, "catalog_id")) {
            $resPe = @$conn->query(
                "SELECT COUNT(*) AS c FROM ponto_entrega
                 WHERE catalog_id IS NOT NULL AND catalog_id <> ''
                   AND (status_operacao = 'ativo' OR status_operacao IS NULL)"
            );
        } else {
            $resPe = @$conn->query(
                "SELECT COUNT(*) AS c FROM ponto_entrega
                 WHERE status_operacao = 'ativo' OR status_operacao IS NULL"
            );
        }
        if (!$resPe) {
            $resPe = @$conn->query("SELECT COUNT(*) AS c FROM ponto_entrega");
        }
        if ($resPe) {
            $rowPe = $resPe->fetch_assoc();
            $ecopontosAtivos = (int) ($rowPe["c"] ?? 0);
            $resPe->free();
        }
    }

    $toneladas = round($kgTotal / 1000, 1);
    $impacto = [
        "arvores" => (int) max(0, round($toneladas * 33)),
        "agua_litros" => (int) max(0, round($toneladas * 7200)),
        "energia_mwh" => round($toneladas * 1.03, 1),
    ];

    return [
        "resumo" => [
            "total_toneladas" => $toneladas,
            "total_trend_pct" => $trendPct,
            "ecopontos_ativos" => $ecopontosAtivos,
            "participacoes" => $participacoes,
        ],
        "impacto" => $impacto,
        "coleta_mensal" => [
            "labels" => $mesLabels,
            "values" => $mesValues,
            "trend_pct" => $trendPct,
        ],
        "materiais" => [
            "labels" => $matLabels,
            "values" => $matValues,
            "colors" => $matColors,
            "total_kg" => (int) round($kgTotal),
            "total_pct" => $totalPct,
        ],
        "evolucao" => [
            "labels" => $evolucaoLabels,
            "values" => $evolucaoValues,
        ],
        "bairros" => ecoplat_relatorio_listar_bairros($conn),
        "meta" => [
            "fonte" => "banco",
            "desde" => $desde,
            "ate" => $ate,
            "bairro" => $bairroFiltro,
            "total_linhas" => count($linhas),
        ],
    ];
}
