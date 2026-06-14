<?php

declare(strict_types=1);

require_once __DIR__ . "/usuarios-seed-data.php";
require_once __DIR__ . "/admin-ecoponto-data.php";
require_once __DIR__ . "/coletas-ecoponto-seed.php";
require_once __DIR__ . "/notificacoes_helper.php";
require_once __DIR__ . "/configuracoes-plataforma.php";
require_once __DIR__ . "/ecopontos-repository.php";

const ECOSEED_COMP_EMAIL_SUFFIX = ECOSEED_USUARIOS_EMAIL_SUFFIX;
const ECOSEED_COMP_ENTREGAS_POR_MORADOR = 3;

function ecoseed_comp_listar_moradores(mysqli $conn): array
{
    $like = "%" . ECOSEED_COMP_EMAIL_SUFFIX;
    $cols = "u.id_usuario, u.nome, u.email";
    if (ecoadm_usuario_tem_coluna($conn, "status_conta")) {
        $cols .= ", COALESCE(u.status_conta, 'ativo') AS status_conta";
    } else {
        $cols .= ", 'ativo' AS status_conta";
    }

    $stmt = $conn->prepare(
        "SELECT {$cols} FROM usuario u
         WHERE u.tipo_usuario = 'morador' AND u.email LIKE ?
         ORDER BY u.id_usuario ASC
         LIMIT ?"
    );
    if (!$stmt) {
        return [];
    }
    $lim = ECOSEED_USUARIOS_TOTAL;
    $stmt->bind_param("si", $like, $lim);
    if (!$stmt->execute()) {
        $stmt->close();
        return [];
    }
    $rows = ecocoleta_stmt_fetch_all_assoc($stmt);
    $stmt->close();
    return $rows;
}

function ecoseed_comp_contar_entregas_moradores(mysqli $conn): int
{
    $like = "%" . ECOSEED_COMP_EMAIL_SUFFIX;
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS c FROM entrega e
         INNER JOIN usuario u ON u.id_usuario = e.id_usuario
         WHERE u.email LIKE ?"
    );
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("s", $like);
    $stmt->execute();
    $c = 0;
    $stmt->bind_result($c);
    $stmt->fetch();
    $stmt->close();
    return (int) $c;
}

function ecoseed_comp_limpar_entregas_moradores(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return;
    }
    $like = "%" . ECOSEED_COMP_EMAIL_SUFFIX;
    if (ecocoleta_tabela_existe($conn, "item_entrega")) {
        $stmtIe = $conn->prepare(
            "DELETE ie FROM item_entrega ie
             INNER JOIN entrega e ON e.id_entrega = ie.id_entrega
             INNER JOIN usuario u ON u.id_usuario = e.id_usuario
             WHERE u.email LIKE ?"
        );
        if ($stmtIe) {
            $stmtIe->bind_param("s", $like);
            $stmtIe->execute();
            $stmtIe->close();
        }
    }
    $stmt = $conn->prepare(
        "DELETE e FROM entrega e
         INNER JOIN usuario u ON u.id_usuario = e.id_usuario
         WHERE u.email LIKE ?"
    );
    if ($stmt) {
        $stmt->bind_param("s", $like);
        $stmt->execute();
        $stmt->close();
    }
}

function ecoseed_comp_limpar_resgates_moradores(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "resgate")) {
        return;
    }
    $like = "%" . ECOSEED_COMP_EMAIL_SUFFIX;
    $stmt = $conn->prepare(
        "DELETE r FROM resgate r
         INNER JOIN usuario u ON u.id_usuario = r.id_usuario
         WHERE u.email LIKE ?"
    );
    if ($stmt) {
        $stmt->bind_param("s", $like);
        $stmt->execute();
        $stmt->close();
    }
}

function ecoseed_comp_limpar_notificacoes_moradores(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "notificacao")) {
        return;
    }
    $like = "%" . ECOSEED_COMP_EMAIL_SUFFIX;
    $stmt = $conn->prepare(
        "DELETE n FROM notificacao n
         INNER JOIN usuario u ON u.id_usuario = n.id_usuario
         WHERE u.email LIKE ?"
    );
    if ($stmt) {
        $stmt->bind_param("s", $like);
        $stmt->execute();
        $stmt->close();
    }
}

function ecoseed_comp_listar_pevs(mysqli $conn): array
{
    if (!ecocoleta_tabela_existe($conn, "ponto_entrega")) {
        return [];
    }
    $ids = [];
    $res = @$conn->query("SELECT id_pev FROM ponto_entrega ORDER BY id_pev ASC LIMIT 30");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $ids[] = (int) ($row["id_pev"] ?? 0);
        }
        $res->free();
    }
    return array_values(array_filter($ids));
}

function ecoseed_comp_garantir_materiais(mysqli $conn): int
{
    if (!ecocoleta_tabela_existe($conn, "material")) {
        return 0;
    }
    $res = @$conn->query("SELECT COUNT(*) AS c FROM material");
    $total = 0;
    if ($res) {
        $total = (int) (($res->fetch_assoc()["c"] ?? 0));
        $res->free();
    }
    if ($total > 0) {
        return 0;
    }
    @$conn->query(
        "INSERT INTO material (descricao, tipo_material) VALUES
         ('Plástico', 'plastico'),
         ('Papel', 'papel'),
         ('Vidro', 'vidro'),
         ('Metal', 'metal'),
         ('Orgânico', 'organico')"
    );
    return 5;
}

function ecoseed_comp_mapa_materiais(mysqli $conn): array
{
    $map = [];
    if (!ecocoleta_tabela_existe($conn, "material")) {
        return $map;
    }
    $res = @$conn->query("SELECT id_material, tipo_material, descricao FROM material");
    if (!$res) {
        return $map;
    }
    while ($row = $res->fetch_assoc()) {
        $slug = ecoadm_material_slug((string) ($row["tipo_material"] ?? $row["descricao"] ?? ""));
        $map[$slug] = (int) ($row["id_material"] ?? 0);
    }
    $res->free();
    return $map;
}

function ecoseed_comp_garantir_premios(mysqli $conn): int
{
    if (!ecocoleta_tabela_existe($conn, "parceiro") || !ecocoleta_tabela_existe($conn, "beneficio")) {
        return 0;
    }

    @$conn->query(
        "INSERT IGNORE INTO parceiro (id_parceiro, nome_parceiro, endereco, tipo_estabelecimento, id_bairro)
         VALUES (1, 'Rede de Parceiros EcoColeta', NULL, 'Premios digitais', NULL)"
    );

    $premios = [
        [1, "PowerFit Club - 15%", 347, "ECO100OFF"],
        [2, "IronFlex - 30%", 289, "IRON30"],
        [3, "MoveUp Gym - 20%", 412, "MOVEUP20"],
        [4, "Pao Nobre - 15%", 150, "PANOBRE15"],
        [5, "Forno Dourado - 20%", 200, "DOURADO20"],
        [6, "Trigo e Sabor - 10%", 100, "TRIGO10"],
        [7, "VitaNex - 10%", 120, "VITANEX10"],
        [8, "PharmaLeaf - 20%", 220, "PHARMALEAF20"],
        [9, "SaudePrime - 25%", 280, "SAUDEPRIME25"],
        [10, "MaxCompra - 10%", 130, "MAXCOMPRA10"],
        [11, "MercaPlus - 30%", 320, "MERCAPLUS30"],
        [12, "BomPreco - 20%", 210, "BOMPRECO20"],
        [13, "Sabor da Vila - 15%", 180, "VILA15"],
        [14, "Essencia Gourmet - 10%", 110, "ESSENCIA10"],
        [15, "Bistro Raiz - 10%", 105, "RAIZ10"],
        [16, "GlowBella - 10%", 125, "GLOW10"],
        [17, "MakeLuxe - 15%", 170, "LUXE15"],
        [18, "BeautyCharm - 20%", 240, "CHARM20"],
        [19, "EcoStyle - 18%", 230, "ECOSTYLE18"],
        [20, "VerdeVibe - 25%", 260, "VERDEVIBE25"],
    ];

    $stmt = $conn->prepare(
        "INSERT INTO beneficio (id_beneficio, nome_beneficio, pontos_necessarios, codigo_cupom, id_parceiro)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           nome_beneficio = VALUES(nome_beneficio),
           pontos_necessarios = VALUES(pontos_necessarios),
           codigo_cupom = VALUES(codigo_cupom)"
    );
    if (!$stmt) {
        return 0;
    }

    $n = 0;
    foreach ($premios as [$id, $nome, $pts, $cupom]) {
        $stmt->bind_param("isis", $id, $nome, $pts, $cupom);
        if ($stmt->execute()) {
            $n++;
        }
    }
    $stmt->close();
    return $n;
}

function ecoseed_comp_garantir_configuracao(mysqli $conn): bool
{
    ecoplat_config_garantir_tabela($conn);
    $stmt = $conn->prepare("SELECT chave FROM configuracao_plataforma WHERE chave = 'plataforma' LIMIT 1");
    if ($stmt) {
        $stmt->execute();
        $tem = ecocoleta_stmt_num_rows($stmt) > 0;
        $stmt->close();
        if ($tem) {
            return true;
        }
    }

    $config = ecoplat_config_padrao();
    $config["geral"]["email_contato"] = "contato@ecocoleta.local";
    $config["notificacoes"]["coletas_agendadas"] = true;
    $config["notificacoes"]["ecopontos_problemas"] = true;
    $config["notificacoes"]["relatorios_semanais"] = true;
    return ecoplat_config_salvar($conn, $config);
}

function ecoseed_comp_garantir_admins(mysqli $conn): array
{
    $stats = ["plataforma" => 0, "ecoponto" => 0];

    if (!ecocoleta_tabela_existe($conn, "administrador_plataforma")) {
        @$conn->query(
            "CREATE TABLE IF NOT EXISTS administrador_plataforma (
                id_admin INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(120) NOT NULL,
                email VARCHAR(160) NOT NULL,
                senha_hash VARCHAR(255) NOT NULL,
                cargo VARCHAR(120) NOT NULL DEFAULT 'Administrador da plataforma',
                status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
                criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ultimo_login DATETIME NULL,
                UNIQUE KEY uq_admin_plataforma_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }

    $stmt = $conn->prepare("SELECT id_admin FROM administrador_plataforma WHERE email = ? LIMIT 1");
    $emailPlat = "admin.plataforma@ecocoleta.local";
    if ($stmt) {
        $stmt->bind_param("s", $emailPlat);
        $stmt->execute();
        $id = 0;
        $stmt->bind_result($id);
        $existe = $stmt->fetch() && $id > 0;
        $stmt->close();
        if (!$existe) {
            $hash = password_hash("EcoPlat@2026", PASSWORD_DEFAULT);
            $ins = $conn->prepare(
                "INSERT INTO administrador_plataforma (nome, email, senha_hash, cargo)
                 VALUES (?, ?, ?, ?)"
            );
            if ($ins) {
                $nome = "Administrador da Plataforma";
                $cargo = "Diretor de operacoes";
                $ins->bind_param("ssss", $nome, $emailPlat, $hash, $cargo);
                if ($ins->execute()) {
                    $stats["plataforma"] = 1;
                }
                $ins->close();
            }
        }
    }

    ecoadm_garantir_schema_integracao($conn);
    $stmtE = $conn->prepare("SELECT id_admin FROM administrador_ecoponto WHERE email = ? LIMIT 1");
    $emailEco = "admin.ecoponto@ecocoleta.local";
    if ($stmtE) {
        $stmtE->bind_param("s", $emailEco);
        $stmtE->execute();
        $id = 0;
        $stmtE->bind_result($id);
        $existe = $stmtE->fetch() && $id > 0;
        $stmtE->close();
        if (!$existe) {
            $hash = password_hash("EcoPonto@123", PASSWORD_DEFAULT);
            $ins = $conn->prepare(
                "INSERT INTO administrador_ecoponto (nome, email, senha_hash, nome_ecoponto)
                 VALUES (?, ?, ?, ?)"
            );
            if ($ins) {
                $nome = "Administrador EcoPonto";
                $ecoponto = ecoadm_pev_padrao_nome();
                $ins->bind_param("ssss", $nome, $emailEco, $hash, $ecoponto);
                if ($ins->execute()) {
                    $stats["ecoponto"] = 1;
                    $idAdmin = (int) $conn->insert_id;
                    if ($idAdmin > 0) {
                        ecoadm_garantir_pev_demo($conn, $idAdmin, ecoadm_pev_padrao_nome());
                    }
                }
                $ins->close();
            }
        } else {
            ecoadm_garantir_pev_demo($conn, (int) $id, ecoadm_pev_padrao_nome());
        }
    }

    $stats["ecoponto"] += ecoadm_garantir_admins_ecoponto_equipe($conn);

    return $stats;
}

function ecoseed_comp_sincronizar_entregas(mysqli $conn, bool $forcar = false): array
{
    $stats = ["inseridos" => 0, "itens" => 0];

    if (!ecocoleta_tabela_existe($conn, "entrega")) {
        return $stats;
    }

    ecoseed_comp_garantir_materiais($conn);
    $moradores = ecoseed_comp_listar_moradores($conn);
    $materiais = ecoseed_comp_mapa_materiais($conn);
    $idPevCentral = ecoseed_pev_padrao_id($conn);

    if ($moradores === [] || $idPevCentral <= 0) {
        return $stats;
    }

    $existentes = ecoseed_comp_contar_entregas_moradores($conn);
    $esperado = count($moradores) * ECOSEED_COMP_ENTREGAS_POR_MORADOR;

    if (!$forcar && $existentes >= $esperado) {
        return $stats;
    }

    if ($forcar && $existentes > 0) {
        ecoseed_comp_limpar_entregas_moradores($conn);
    }

    $pesosMaterial = [
        "plastico" => 1.35,
        "papel" => 1.0,
        "vidro" => 0.85,
        "metal" => 0.7,
        "organico" => 1.1,
    ];
    $temItens = ecocoleta_tabela_existe($conn, "item_entrega");
    $hoje = new DateTimeImmutable("today");

    foreach ($moradores as $idx => $morador) {
        if ((string) ($morador["status_conta"] ?? "ativo") === "inativo" && $idx % 3 !== 0) {
            continue;
        }

        $idUsuario = (int) ($morador["id_usuario"] ?? 0);
        if ($idUsuario <= 0) {
            continue;
        }

        $offsets = [2 + ($idx % 4), 18 + ($idx % 25), 55 + ($idx % 60)];

        foreach ($offsets as $j => $diasAtras) {
            $dataEntrega = $hoje->modify("-{$diasAtras} days")
                ->modify("-" . (($idx + $j) % 9) . " hours")
                ->format("Y-m-d H:i:s");

            $idPev = $idPevCentral;

            $pontos = 42 + (($idx * 13 + $j * 19) % 58);

            $stmtE = $conn->prepare(
                "INSERT INTO entrega (data_entrega, peso_total, pontos_gerados, id_usuario, id_pev)
                 VALUES (?, 0, ?, ?, ?)"
            );
            if (!$stmtE) {
                continue;
            }
            $stmtE->bind_param("siii", $dataEntrega, $pontos, $idUsuario, $idPev);
            if (!$stmtE->execute()) {
                $stmtE->close();
                continue;
            }
            $idEntrega = (int) $conn->insert_id;
            $stmtE->close();
            $stats["inseridos"]++;

            if (!$temItens || $materiais === []) {
                $peso = round(8 + (($idx + $j) % 28) + (($idx * 3) % 10) / 10, 2);
                $upd = $conn->prepare("UPDATE entrega SET peso_total = ? WHERE id_entrega = ?");
                if ($upd) {
                    $upd->bind_param("di", $peso, $idEntrega);
                    $upd->execute();
                    $upd->close();
                }
                continue;
            }

            $slugs = array_keys($materiais);
            $pesoTotal = 0.0;
            $qtdItens = min(4, count($slugs));

            for ($k = 0; $k < $qtdItens; $k++) {
                $slug = $slugs[($idx + $j + $k) % count($slugs)];
                $idMat = $materiais[$slug] ?? 0;
                if ($idMat <= 0) {
                    continue;
                }
                $fator = $pesosMaterial[$slug] ?? 1.0;
                $peso = round((4 + (($idx + $k) % 14) + (($j * 7) % 10) / 10) * $fator, 2);
                $pesoTotal += $peso;

                $stmtI = $conn->prepare(
                    "INSERT INTO item_entrega (quantidade, peso, id_entrega, id_material) VALUES (1, ?, ?, ?)"
                );
                if ($stmtI) {
                    $stmtI->bind_param("dii", $peso, $idEntrega, $idMat);
                    if ($stmtI->execute()) {
                        $stats["itens"]++;
                    }
                    $stmtI->close();
                }
            }

            if ($pesoTotal > 0) {
                $upd = $conn->prepare("UPDATE entrega SET peso_total = ? WHERE id_entrega = ?");
                if ($upd) {
                    $upd->bind_param("di", $pesoTotal, $idEntrega);
                    $upd->execute();
                    $upd->close();
                }
            }
        }
    }

    return $stats;
}

function ecoseed_comp_sincronizar_resgates(mysqli $conn, bool $forcar = false): array
{
    $stats = ["inseridos" => 0, "total" => 0];

    if (!ecocoleta_tabela_existe($conn, "resgate") || !ecocoleta_tabela_existe($conn, "beneficio")) {
        return $stats;
    }

    ecoseed_comp_garantir_premios($conn);

    $like = "%" . ECOSEED_COMP_EMAIL_SUFFIX;
    if ($forcar) {
        ecoseed_comp_limpar_resgates_moradores($conn);
    }

    $stmt = $conn->prepare(
        "SELECT u.id_usuario,
                COALESCE(SUM(e.pontos_gerados), 0) AS pts_ganhos,
                COALESCE((
                    SELECT SUM(r2.pontos_utilizados) FROM resgate r2 WHERE r2.id_usuario = u.id_usuario
                ), 0) AS pts_gastos
         FROM usuario u
         LEFT JOIN entrega e ON e.id_usuario = u.id_usuario
         WHERE u.email LIKE ?
         GROUP BY u.id_usuario
         ORDER BY u.id_usuario ASC
         LIMIT ?"
    );
    if (!$stmt) {
        return $stats;
    }
    $lim = ECOSEED_USUARIOS_TOTAL;
    $stmt->bind_param("si", $like, $lim);
    if (!$stmt->execute()) {
        $stmt->close();
        return $stats;
    }

    $beneficiosResgate = [6, 7, 4, 14, 10, 16];
    $rows = ecocoleta_stmt_fetch_all_assoc($stmt);
    $stmt->close();

    foreach ($rows as $idx => $row) {
        $idUsuario = (int) ($row["id_usuario"] ?? 0);
        $saldo = (int) ($row["pts_ganhos"] ?? 0) - (int) ($row["pts_gastos"] ?? 0);
        if ($idUsuario <= 0 || $saldo < 100 || $idx >= 22) {
            continue;
        }

        $idBeneficio = $beneficiosResgate[$idx % count($beneficiosResgate)];
        $diasAtras = 3 + ($idx % 40);
        $pontosNec = 100;

        $stmtPts = $conn->prepare("SELECT pontos_necessarios FROM beneficio WHERE id_beneficio = ? LIMIT 1");
        if ($stmtPts) {
            $stmtPts->bind_param("i", $idBeneficio);
            if ($stmtPts->execute()) {
                $p = 0;
                $stmtPts->bind_result($p);
                if ($stmtPts->fetch() && $p > 0) {
                    $pontosNec = (int) $p;
                }
            }
            $stmtPts->close();
        }

        if ($saldo < $pontosNec) {
            continue;
        }

        $dataResgate = (new DateTimeImmutable("now"))
            ->modify("-{$diasAtras} days")
            ->format("Y-m-d H:i:s");

        $ins = $conn->prepare(
            "INSERT IGNORE INTO resgate (data_resgate, pontos_utilizados, id_usuario, id_beneficio)
             VALUES (?, ?, ?, ?)"
        );
        if (!$ins) {
            continue;
        }
        $ins->bind_param("siii", $dataResgate, $pontosNec, $idUsuario, $idBeneficio);
        if ($ins->execute() && $ins->affected_rows > 0) {
            $stats["inseridos"]++;
        }
        $ins->close();
    }

    $stmtC = $conn->prepare(
        "SELECT COUNT(*) AS c FROM resgate r
         INNER JOIN usuario u ON u.id_usuario = r.id_usuario
         WHERE u.email LIKE ?"
    );
    if ($stmtC) {
        $stmtC->bind_param("s", $like);
        $stmtC->execute();
        $c = 0;
        $stmtC->bind_result($c);
        $stmtC->fetch();
        $stmtC->close();
        $stats["total"] = (int) $c;
    }

    return $stats;
}

function ecoseed_comp_sincronizar_notificacoes(mysqli $conn, bool $forcar = false): array
{
    $stats = ["moradores" => 0, "admins" => 0];

    if ($forcar) {
        ecoseed_comp_limpar_notificacoes_moradores($conn);
        if (ecocoleta_ensure_notificacao_admin_table($conn)) {
            @$conn->query("DELETE FROM notificacao_admin WHERE ref_tipo LIKE 'seed_%'");
        }
    }

    foreach (ecoseed_comp_listar_moradores($conn) as $morador) {
        $idUsuario = (int) ($morador["id_usuario"] ?? 0);
        if ($idUsuario <= 0) {
            continue;
        }
        ecocoleta_notif_sincronizar_atividade($conn, $idUsuario);
        $stats["moradores"]++;
    }

    if (!ecocoleta_ensure_notificacao_admin_table($conn)) {
        return $stats;
    }

    $stmt = $conn->prepare("SELECT id_admin FROM administrador_ecoponto ORDER BY id_admin ASC LIMIT 3");
    if (!$stmt || !$stmt->execute()) {
        if ($stmt) {
            $stmt->close();
        }
        return $stats;
    }

    $avisos = [
        ["coleta", "importante", "12 coletas hoje", "Painel Coletas: 7 caminhão e 5 prefeitura agendadas para hoje.", "bell", "Hoje", "seed_coleta_hoje", 1],
        ["material", "normal", "Pico de plástico", "Entregas de plástico subiram 18% esta semana no EcoPonto Juazeiro Centro.", "yellow", "KPI", "seed_kpi_plastico", 2],
        ["sistema", "normal", "Relatório disponível", "O relatório mensal de materiais já pode ser exportado em PDF.", "purple", "Novo", "seed_relatorio", 3],
        ["coleta", "importante", "Coleta em andamento", "3 coletas com status em andamento aguardam conclusão.", "yellow", "Ação", "seed_andamento", 4],
        ["sistema", "normal", "50 moradores ativos", "Base de moradores seed sincronizada com endereços do Cariri.", "green", null, "seed_usuarios", 5],
    ];

    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $adminRow) {
        $idAdmin = (int) ($adminRow["id_admin"] ?? 0);
        if ($idAdmin <= 0) {
            continue;
        }
        foreach ($avisos as $aviso) {
            if (ecocoleta_notif_inserir_admin(
                $conn,
                $idAdmin,
                $aviso[0],
                $aviso[1],
                $aviso[2],
                $aviso[3],
                $aviso[4],
                $aviso[5],
                $aviso[6],
                $aviso[7]
            )) {
                $stats["admins"]++;
            }
        }
    }
    $stmt->close();

    return $stats;
}

function ecoseed_complementar_sincronizar(mysqli $conn, bool $forcar = false): array
{
    ecoadm_garantir_schema_integracao($conn);
    ecopontos_garantir_schema($conn);

    $materiais = ecoseed_comp_garantir_materiais($conn);
    $premios = ecoseed_comp_garantir_premios($conn);
    $configOk = ecoseed_comp_garantir_configuracao($conn);
    $admins = ecoseed_comp_garantir_admins($conn);
    $entregas = ecoseed_comp_sincronizar_entregas($conn, $forcar);
    $resgates = ecoseed_comp_sincronizar_resgates($conn, $forcar);
    $notificacoes = ecoseed_comp_sincronizar_notificacoes($conn, $forcar);
    $realinhado = ecoseed_realinhar_ecoponto_padrao($conn);

    return [
        "materiais_novos" => $materiais,
        "premios_sync" => $premios,
        "config_ok" => $configOk,
        "admins" => $admins,
        "entregas" => $entregas,
        "resgates" => $resgates,
        "notificacoes" => $notificacoes,
        "realinhado" => $realinhado,
        "id_pev_padrao" => ecoseed_pev_padrao_id($conn),
        "entregas_total" => ecoseed_comp_contar_entregas_moradores($conn),
    ];
}

function ecoseed_complementar_limpar(mysqli $conn): void
{
    ecoseed_comp_limpar_notificacoes_moradores($conn);
    ecoseed_comp_limpar_resgates_moradores($conn);
    ecoseed_comp_limpar_entregas_moradores($conn);
    if (ecocoleta_ensure_notificacao_admin_table($conn)) {
        @$conn->query("DELETE FROM notificacao_admin WHERE ref_tipo LIKE 'seed_%'");
    }
}
