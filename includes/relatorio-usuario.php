<?php

require_once __DIR__ . "/ranking-ruas.php";
require_once __DIR__ . "/admin-ecoponto-data.php";

function ecorep_intervalo(string $periodo = "mensal"): array
{
    $hoje = new DateTimeImmutable("today");

    if ($periodo === "semana" || $periodo === "semanal") {
        $intervalo = ecorank_intervalo("semana");
        $intervalo["rotulo"] = "semanal";
        return $intervalo;
    }

    if ($periodo === "trimestral") {
        return [
            "desde" => $hoje->modify("-2 months")->modify("first day of this month")->format("Y-m-d"),
            "ate" => $hoje->format("Y-m-d"),
            "rotulo" => "trimestral",
        ];
    }

    return ecorank_intervalo("mes") + ["rotulo" => "mensal"];
}

function ecorep_format_kg_ui(float $kg): string
{
    if ($kg <= 0) {
        return "0 kg";
    }
    if ($kg < 1) {
        return number_format($kg, 1, ",", ".") . " kg";
    }
    if (abs($kg - round($kg)) < 0.05) {
        return (int) round($kg) . " kg";
    }
    return number_format($kg, 1, ",", ".") . " kg";
}

function ecorep_material_catalogo(): array
{
    return [
        "plastico" => ["nome" => "Plástico", "img" => "assets/images/garrafa.png"],
        "papel" => ["nome" => "Papel", "img" => "assets/images/papel.png"],
        "vidro" => ["nome" => "Vidro", "img" => "assets/images/vidro.png"],
        "metal" => ["nome" => "Metal", "img" => "assets/images/lata.png"],
    ];
}

function ecorep_pontos_usuario_periodo(mysqli $conn, int $idUsuario, string $desde, string $ate): int
{
    if ($idUsuario <= 0 || !ecocoleta_tabela_existe($conn, "entrega")) {
        return 0;
    }
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(pontos_gerados), 0) AS pts
         FROM entrega
         WHERE id_usuario = ? AND DATE(data_entrega) >= ? AND DATE(data_entrega) <= ?"
    );
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("iss", $idUsuario, $desde, $ate);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    return (int) ($row["pts"] ?? 0);
}

function ecorep_kg_usuario_hoje(mysqli $conn, int $idUsuario): float
{
    $hoje = (new DateTimeImmutable("today"))->format("Y-m-d");
    return ecorank_kg_usuario_periodo($conn, $idUsuario, $hoje, $hoje);
}

function ecorep_agregar_bairros(mysqli $conn, string $desde, string $ate, int $limite = 4): array
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return [];
    }

    $sql = "SELECT COALESCE(NULLIF(TRIM(b.nome_bairro), ''), 'Sem bairro') AS nome,
                   COALESCE(SUM(e.peso_total), 0) AS kg
            FROM entrega e
            INNER JOIN usuario u ON u.id_usuario = e.id_usuario
            LEFT JOIN rua r ON r.id_rua = u.id_rua
            LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
            WHERE DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?
            GROUP BY b.id_bairro, b.nome_bairro
            HAVING kg > 0
            ORDER BY kg DESC
            LIMIT ?";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }
    $stmt->bind_param("ssi", $desde, $ate, $limite);
    if (!$stmt->execute()) {
        $stmt->close();
        return [];
    }

    $iconClasses = ["centro", "esperanca", "jardim", "industrial"];
    $lista = [];
    $i = 0;
    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $kg = (float) ($row["kg"] ?? 0);
        $lista[] = [
            "nome" => (string) ($row["nome"] ?? "Sem bairro"),
            "kg" => round($kg, 1),
            "kg_fmt" => ecorep_format_kg_ui($kg),
            "icon_class" => $iconClasses[$i % count($iconClasses)],
        ];
        $i++;
    }
    $stmt->close();
    return $lista;
}

function ecorep_agregar_materiais_usuario(mysqli $conn, int $idUsuario, string $desde, string $ate): array
{
    $catalogo = ecorep_material_catalogo();
    $porSlug = array_fill_keys(array_keys($catalogo), 0.0);

    if (
        $idUsuario <= 0
        || !ecocoleta_tabela_existe($conn, "entrega")
        || !ecocoleta_tabela_existe($conn, "item_entrega")
        || !ecocoleta_tabela_existe($conn, "material")
    ) {
        return ecorep_materiais_formatados($porSlug);
    }

    $stmt = $conn->prepare(
        "SELECT m.tipo_material, m.descricao,
                SUM(COALESCE(ie.peso, ie.quantidade, 0)) AS kg
         FROM entrega e
         INNER JOIN item_entrega ie ON ie.id_entrega = e.id_entrega
         INNER JOIN material m ON m.id_material = ie.id_material
         WHERE e.id_usuario = ? AND DATE(e.data_entrega) >= ? AND DATE(e.data_entrega) <= ?
         GROUP BY m.id_material, m.tipo_material, m.descricao"
    );
    if (!$stmt) {
        return ecorep_materiais_formatados($porSlug);
    }
    $stmt->bind_param("iss", $idUsuario, $desde, $ate);
    if ($stmt->execute()) {
        foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
            $slug = ecoadm_material_slug((string) ($row["tipo_material"] ?? $row["descricao"] ?? ""));
            if (!isset($porSlug[$slug])) {
                $porSlug[$slug] = 0.0;
            }
            $porSlug[$slug] += (float) ($row["kg"] ?? 0);
        }
    }
    $stmt->close();

    if (array_sum($porSlug) <= 0) {
        $kgTotal = ecorank_kg_usuario_periodo($conn, $idUsuario, $desde, $ate);
        if ($kgTotal > 0) {
            $porSlug["plastico"] = round($kgTotal * 0.35, 1);
            $porSlug["papel"] = round($kgTotal * 0.2, 1);
            $porSlug["vidro"] = round($kgTotal * 0.2, 1);
            $porSlug["metal"] = round($kgTotal * 0.25, 1);
        }
    }

    return ecorep_materiais_formatados($porSlug);
}

function ecorep_materiais_formatados(array $porSlug): array
{
    $catalogo = ecorep_material_catalogo();
    $lista = [];
    foreach ($catalogo as $slug => $meta) {
        $kg = (float) ($porSlug[$slug] ?? 0);
        $lista[] = [
            "slug" => $slug,
            "nome" => $meta["nome"],
            "img" => $meta["img"],
            "kg" => round($kg, 1),
            "kg_fmt" => ecorep_format_kg_ui($kg),
        ];
    }
    return $lista;
}

function ecorep_grafico_dias_semana(mysqli $conn, int $idUsuario, string $desde, string $ate): array
{
    $labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    $valores = array_fill(0, 7, 0.0);

    if ($idUsuario <= 0 || !ecocoleta_tabela_existe($conn, "entrega")) {
        return ["labels" => $labels, "valores" => $valores];
    }

    $stmt = $conn->prepare(
        "SELECT DAYOFWEEK(data_entrega) AS dow, COALESCE(SUM(peso_total), 0) AS kg
         FROM entrega
         WHERE id_usuario = ? AND DATE(data_entrega) >= ? AND DATE(data_entrega) <= ?
         GROUP BY DAYOFWEEK(data_entrega)"
    );
    if (!$stmt) {
        return ["labels" => $labels, "valores" => $valores];
    }
    $stmt->bind_param("iss", $idUsuario, $desde, $ate);
    if ($stmt->execute()) {
        foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
            $dow = (int) ($row["dow"] ?? 0);
            $idx = $dow >= 1 && $dow <= 7 ? $dow - 1 : -1;
            if ($idx >= 0) {
                $valores[$idx] = round((float) ($row["kg"] ?? 0), 1);
            }
        }
    }
    $stmt->close();

    return ["labels" => $labels, "valores" => $valores];
}

function ecorep_carregar_usuario(mysqli $conn, int $idUsuario): array
{
    if ($idUsuario <= 0) {
        return [];
    }

    $hasFoto = false;
    $qc = @$conn->query("SHOW COLUMNS FROM usuario LIKE 'foto_perfil'");
    if ($qc) {
        $hasFoto = $qc->num_rows > 0;
        $qc->free();
    }

    $sql = "SELECT u.id_usuario, u.nome, COALESCE(r.nome_rua, '') AS rua, COALESCE(b.nome_bairro, '') AS bairro";
    if ($hasFoto) {
        $sql .= ", u.foto_perfil";
    }
    $sql .= " FROM usuario u
              LEFT JOIN rua r ON r.id_rua = u.id_rua
              LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
              WHERE u.id_usuario = ? LIMIT 1";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }
    $stmt->bind_param("i", $idUsuario);
    if (!$stmt->execute()) {
        $stmt->close();
        return [];
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    if (!$row) {
        return [];
    }

    $usuario = [
        "id" => (int) $row["id_usuario"],
        "nome" => (string) ($row["nome"] ?? ""),
        "rua" => (string) ($row["rua"] ?? ""),
        "bairro" => (string) ($row["bairro"] ?? ""),
        "saldo_ecopoints" => ecocoleta_obter_saldo_usuario($conn, $idUsuario),
    ];
    if ($hasFoto && !empty($row["foto_perfil"])) {
        $usuario["foto_perfil"] = (string) $row["foto_perfil"];
    }
    return $usuario;
}

function ecorep_montar_destaque(
    mysqli $conn,
    int $idUsuario,
    string $desde,
    string $ate,
    array $usuario
): array {
    $kgMes = ecorank_kg_usuario_periodo($conn, $idUsuario, $desde, $ate);
    $ptsMes = ecorep_pontos_usuario_periodo($conn, $idUsuario, $desde, $ate);
    $ruaUser = ecorank_obter_rua_usuario($conn, $idUsuario);
    $listaRuas = ecorank_agregar_ruas($conn, $desde, $ate);
    $posicao = ecorank_resolver_posicao_rua($conn, $listaRuas, $ruaUser, $desde, $ate);

    $pos = (int) ($posicao["posicao"] ?? 0);
    $rotulo = "Seu desempenho no período";
    if ($pos === 1) {
        $rotulo = "Coletor destaque do mês";
    } elseif ($pos > 1 && $pos <= 3) {
        $rotulo = "Entre os destaques da rua";
    }

    return [
        "nome" => (string) ($usuario["nome"] ?? ""),
        "rua" => (string) ($ruaUser["nome_rua"] ?? $usuario["rua"] ?? ""),
        "bairro" => (string) ($ruaUser["nome_bairro"] ?? $usuario["bairro"] ?? ""),
        "pontos" => $ptsMes,
        "pontos_fmt" => ($ptsMes >= 0 ? "+" : "") . ecorank_formatar_pontos(abs($ptsMes)),
        "kg" => round($kgMes, 1),
        "kg_fmt" => ecorep_format_kg_ui($kgMes),
        "posicao" => $pos,
        "posicao_fmt" => $pos > 0 ? $pos . "º" : "—",
        "rotulo" => $rotulo,
    ];
}

function ecorep_montar_relatorio(mysqli $conn, int $idUsuario, string $periodo = "mensal"): array
{
    $intervalo = ecorep_intervalo($periodo);
    $desde = $intervalo["desde"];
    $ate = $intervalo["ate"];
    $autenticado = $idUsuario > 0;

    $usuario = $autenticado ? ecorep_carregar_usuario($conn, $idUsuario) : [];
    $kgTotal = $autenticado ? ecorank_kg_usuario_periodo($conn, $idUsuario, $desde, $ate) : 0.0;
    $ptsPeriodo = $autenticado ? ecorep_pontos_usuario_periodo($conn, $idUsuario, $desde, $ate) : 0;
    $kgHoje = $autenticado ? ecorep_kg_usuario_hoje($conn, $idUsuario) : 0.0;
    $metaDiariaKg = 2.0;

    $grafico = ecorep_grafico_dias_semana($conn, $autenticado ? $idUsuario : 0, $desde, $ate);

    return [
        "periodo" => $intervalo["rotulo"],
        "desde" => $desde,
        "ate" => $ate,
        "autenticado" => $autenticado,
        "usuario" => $usuario,
        "resumo" => [
            "total_kg" => round($kgTotal, 1),
            "total_kg_fmt" => ecorep_format_kg_ui($kgTotal),
            "pontos_periodo" => $ptsPeriodo,
            "pontos_periodo_fmt" => ecorank_formatar_pontos($ptsPeriodo),
            "saldo_ecopoints" => $autenticado ? (int) ($usuario["saldo_ecopoints"] ?? 0) : 0,
            "meta_diaria_concluida" => $kgHoje >= $metaDiariaKg,
            "meta_diaria_kg" => $metaDiariaKg,
            "kg_hoje" => round($kgHoje, 1),
            "status_trophy" => !$autenticado
                ? "Faça login para ver seu desempenho"
                : ($kgHoje >= $metaDiariaKg
                    ? "Conta ativa · meta diária concluída"
                    : "Conta ativa · continue coletando hoje"),
        ],
        "bairros" => ecorep_agregar_bairros($conn, $desde, $ate, 4),
        "materiais" => $autenticado
            ? ecorep_agregar_materiais_usuario($conn, $idUsuario, $desde, $ate)
            : ecorep_materiais_formatados([]),
        "grafico" => $grafico,
        "destaque" => $autenticado
            ? ecorep_montar_destaque($conn, $idUsuario, $desde, $ate, $usuario)
            : [
                "nome" => "",
                "rua" => "",
                "bairro" => "",
                "pontos" => 0,
                "pontos_fmt" => "+0",
                "kg" => 0,
                "kg_fmt" => "0 kg",
                "posicao" => 0,
                "posicao_fmt" => "—",
                "rotulo" => "Faça login para ver seu destaque",
            ],
    ];
}
