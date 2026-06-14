<?php

declare(strict_types=1);

require_once __DIR__ . "/conexao.php";
require_once __DIR__ . "/admin-ecoponto-data.php";
require_once __DIR__ . "/notificacoes_helper.php";

function coleta_bonus_material_por_tipo(): array
{
    return [
        "eletronico" => 20,
        "eletronicos" => 20,
        "pilhas" => 30,
        "bateria" => 30,
        "baterias" => 30,
        "oleo" => 15,
        "oleo_cozinha" => 15,
        "metal" => 10,
    ];
}

function coleta_bonus_peso(float $pesoKg): int
{
    if ($pesoKg <= 0) {
        return 0;
    }
    if ($pesoKg <= 5) {
        return 10;
    }
    if ($pesoKg <= 15) {
        return 25;
    }
    if ($pesoKg <= 30) {
        return 50;
    }
    return 75;
}

function coleta_bonus_materiais(array $tiposResiduo): int
{
    $mapa = coleta_bonus_material_por_tipo();
    $bonus = 0;
    foreach ($tiposResiduo as $tipo) {
        $t = strtolower(trim((string) $tipo));
        if (isset($mapa[$t])) {
            $bonus += (int) $mapa[$t];
        }
    }
    return $bonus;
}

function coleta_calcular_pontos(float $pesoValidadoKg, array $tiposResiduo, bool $incluirConclusao = true): array
{
    $peso = max(0.0, $pesoValidadoKg);
    $detalhe = [
        "agendamento" => 10,
        "peso" => coleta_bonus_peso($peso),
        "materiais" => coleta_bonus_materiais($tiposResiduo),
    ];
    if ($incluirConclusao) {
        $detalhe["conclusao"] = 50;
    } else {
        $detalhe["conclusao"] = 0;
    }
    $total = array_sum($detalhe);
    return ["total" => max(0, $total), "detalhe" => $detalhe];
}

function coleta_calcular_nivel(int $pontosTotais): array
{
    $p = max(0, $pontosTotais);
    if ($p >= 2000) {
        return ["id" => "eco_lenda", "nome" => "Eco Lenda", "min" => 2000, "max" => null];
    }
    if ($p >= 1000) {
        return ["id" => "eco_heroi", "nome" => "Eco Herói", "min" => 1000, "max" => 1999];
    }
    if ($p >= 500) {
        return ["id" => "eco_guardiao", "nome" => "Eco Guardião", "min" => 500, "max" => 999];
    }
    if ($p >= 200) {
        return ["id" => "eco_amigo", "nome" => "Eco Amigo", "min" => 200, "max" => 499];
    }
    return ["id" => "iniciante", "nome" => "Iniciante", "min" => 0, "max" => 199];
}

function coleta_calcular_diferenca_percentual(float $pesoInformado, float $pesoValidado): float
{
    $inf = max(0.0, $pesoInformado);
    $val = max(0.0, $pesoValidado);
    if ($inf <= 0 && $val <= 0) {
        return 0.0;
    }
    if ($inf <= 0) {
        return 100.0;
    }
    return round(abs($val - $inf) / $inf * 100, 2);
}

function coleta_avaliar_divergencia_peso(float $pesoInformado, float $pesoValidado, int $ocorrenciasAtuais): array
{
    $diff = coleta_calcular_diferenca_percentual($pesoInformado, $pesoValidado);

    if ($diff <= 10) {
        return [
            "status_validacao" => "aprovado_auto",
            "alerta_admin" => "",
            "mensagem_usuario" => "",
            "registrar_ocorrencia" => false,
            "aplicar_penalidade" => "nenhuma",
            "diferenca_percentual" => $diff,
        ];
    }

    if ($diff <= 30) {
        return [
            "status_validacao" => "aprovado_ajuste",
            "alerta_admin" => "Divergência de " . number_format($diff, 1, ",", ".") . "% entre peso informado e validado. Pontos calculados com o peso validado.",
            "mensagem_usuario" => "O peso informado foi diferente do peso validado pelo EcoPonto. Os pontos foram recalculados com base no peso confirmado.",
            "registrar_ocorrencia" => false,
            "aplicar_penalidade" => "nenhuma",
            "diferenca_percentual" => $diff,
        ];
    }

    $novaOcorrencia = $ocorrenciasAtuais + 1;
    $penalidade = "advertencia";
    $mensagem = "Sua coleta apresentou divergência significativa. O caso foi registrado para análise.";
    if ($novaOcorrencia === 2) {
        $penalidade = "reducao_20";
    } elseif ($novaOcorrencia === 3) {
        $penalidade = "zero_pontos";
    } elseif ($novaOcorrencia >= 4) {
        $penalidade = "revisao_conta";
    }

    return [
        "status_validacao" => "divergencia_grave",
        "alerta_admin" => "Divergência grave de " . number_format($diff, 1, ",", ".") . "%. Ocorrência #" . $novaOcorrencia . ".",
        "mensagem_usuario" => $mensagem,
        "registrar_ocorrencia" => true,
        "aplicar_penalidade" => $penalidade,
        "diferenca_percentual" => $diff,
    ];
}

function coleta_aplicar_penalidade_pontos(int $pontos, string $penalidade): int
{
    if ($penalidade === "reducao_20") {
        return max(0, (int) round($pontos * 0.8));
    }
    if ($penalidade === "zero_pontos") {
        return 0;
    }
    return max(0, $pontos);
}

function coleta_garantir_schema_pontuacao(mysqli $conn): void
{
    if (!ecocoleta_tabela_existe($conn, "agendamento_coleta_morador")) {
        return;
    }

    require_once __DIR__ . "/balanca-agendamento.php";
    balanca_garantir_schema_agendamento($conn);

    @$conn->query(
        "ALTER TABLE agendamento_coleta_morador
         MODIFY COLUMN status_coleta
         ENUM('pendente','aguardando_validacao','confirmado','andamento','concluida','cancelado')
         NOT NULL DEFAULT 'confirmado'"
    );

    if (!ecoadm_agendamento_tem_coluna($conn, "peso_validado_kg")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN peso_validado_kg DECIMAL(10,2) NULL DEFAULT NULL AFTER peso_pendente_kg"
        );
    }
    if (!ecoadm_agendamento_tem_coluna($conn, "diferenca_percentual")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN diferenca_percentual DECIMAL(6,2) NULL DEFAULT NULL AFTER peso_validado_kg"
        );
    }
    if (!ecoadm_agendamento_tem_coluna($conn, "status_validacao")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN status_validacao VARCHAR(32) NULL DEFAULT NULL AFTER diferenca_percentual"
        );
    }
    if (!ecoadm_agendamento_tem_coluna($conn, "pontos_estimados")) {
        @$conn->query(
            "ALTER TABLE agendamento_coleta_morador
             ADD COLUMN pontos_estimados INT NULL DEFAULT NULL AFTER pontos_pendentes"
        );
    }

    if (ecocoleta_tabela_existe($conn, "usuario")) {
        if (!ecoadm_usuario_tem_coluna($conn, "ocorrencias_divergencia_peso")) {
            @$conn->query(
                "ALTER TABLE usuario
                 ADD COLUMN ocorrencias_divergencia_peso INT NOT NULL DEFAULT 0"
            );
        }
        if (!ecoadm_usuario_tem_coluna($conn, "nivel_eco")) {
            @$conn->query(
                "ALTER TABLE usuario
                 ADD COLUMN nivel_eco VARCHAR(32) NULL DEFAULT 'iniciante'"
            );
        }
        if (!ecoadm_usuario_tem_coluna($conn, "conta_em_revisao")) {
            @$conn->query(
                "ALTER TABLE usuario
                 ADD COLUMN conta_em_revisao TINYINT(1) NOT NULL DEFAULT 0"
            );
        }
    }

    if (!ecocoleta_tabela_existe($conn, "coleta_divergencia_historico")) {
        @$conn->query(
            "CREATE TABLE IF NOT EXISTS coleta_divergencia_historico (
                id_historico INT AUTO_INCREMENT PRIMARY KEY,
                id_agendamento INT NOT NULL,
                id_usuario INT NOT NULL,
                peso_informado_kg DECIMAL(10,2) NOT NULL,
                peso_validado_kg DECIMAL(10,2) NOT NULL,
                diferenca_percentual DECIMAL(6,2) NOT NULL,
                ocorrencia_numero INT NOT NULL DEFAULT 1,
                penalidade VARCHAR(32) NOT NULL DEFAULT 'advertencia',
                criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_div_usuario (id_usuario),
                KEY idx_div_agendamento (id_agendamento)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }
}

function coleta_tipos_residuo_de_storage(string $storage): array
{
    if (trim($storage) === "") {
        return [];
    }
    $out = [];
    foreach (explode(",", $storage) as $part) {
        $t = strtolower(trim($part));
        if ($t !== "") {
            $out[] = $t;
        }
    }
    return $out;
}

function coleta_atualizar_nivel_usuario(mysqli $conn, int $idUsuario): void
{
    if ($idUsuario <= 0 || !ecoadm_usuario_tem_coluna($conn, "nivel_eco")) {
        return;
    }
    $saldo = ecocoleta_obter_saldo_usuario($conn, $idUsuario);
    $nivel = coleta_calcular_nivel($saldo);
    $nome = (string) ($nivel["nome"] ?? "Iniciante");
    $stmt = $conn->prepare("UPDATE usuario SET nivel_eco = ? WHERE id_usuario = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("si", $nome, $idUsuario);
        $stmt->execute();
        $stmt->close();
    }
}

function coleta_notif_coleta_concluida_admin(
    mysqli $conn,
    int $idUsuario,
    int $idAgendamento,
    int $pontos,
    float $pesoValidadoKg,
    string $nomePev,
    string $mensagemExtra = ""
): void {
    if ($idUsuario <= 0 || $idAgendamento <= 0) {
        return;
    }

    $nomePev = trim($nomePev) !== "" ? trim($nomePev) : "EcoPonto";
    $pesoFmt = number_format(max(0, $pesoValidadoKg), 2, ",", ".");

    if ($pontos > 0) {
        $titulo = "Coleta concluída — " . $pontos . " EcoPontos";
        $msg = "Sua coleta em " . $nomePev . " foi validada na balança (" . $pesoFmt . " kg). "
            . "Total creditado: " . $pontos . " EcoPontos.";
        $badge = "+" . $pontos . " pts";
        $prioridade = "importante";
        $icone = "green";
    } else {
        $titulo = "Coleta concluída";
        $msg = "Sua coleta em " . $nomePev . " foi concluída (" . $pesoFmt . " kg). "
            . "Nenhum EcoPonto foi creditado nesta validação.";
        $badge = null;
        $prioridade = "normal";
        $icone = "bell";
    }

    if (trim($mensagemExtra) !== "") {
        $msg .= " " . trim($mensagemExtra);
    }

    ecocoleta_notif_inserir(
        $conn,
        $idUsuario,
        "pontos",
        $prioridade,
        $titulo,
        $msg,
        $icone,
        $badge,
        "coleta_concluida",
        $idAgendamento
    );
}

function coleta_notif_penalidade_divergencia(
    mysqli $conn,
    int $idUsuario,
    int $idAgendamento,
    string $penalidade,
    float $diferencaPercentual,
    int $ocorrenciaNumero,
    int $pontosAntesPenalidade,
    int $pontosFinais
): void {
    if ($idUsuario <= 0 || $idAgendamento <= 0) {
        return;
    }

    $penalidade = trim($penalidade);
    if ($penalidade === "" || $penalidade === "nenhuma" || $penalidade === "revisao_conta") {
        return;
    }

    $diffFmt = number_format(max(0, $diferencaPercentual), 1, ",", ".");
    $titulo = "Penalidade por divergência de peso";
    $badge = null;
    $icone = "bell";

    switch ($penalidade) {
        case "reducao_20":
            $msg = "Detectamos divergência de " . $diffFmt . "% entre o peso informado e o validado na balança "
                . "(ocorrência #" . $ocorrenciaNumero . "). "
                . "Por isso, os EcoPontos desta coleta foram reduzidos em 20%: de "
                . $pontosAntesPenalidade . " para " . $pontosFinais . " pts.";
            $badge = "-" . max(0, $pontosAntesPenalidade - $pontosFinais) . " pts";
            break;
        case "zero_pontos":
            $msg = "Detectamos divergência de " . $diffFmt . "% entre o peso informado e o validado na balança "
                . "(ocorrência #" . $ocorrenciaNumero . "). "
                . "Como esta é a 3ª ocorrência, nenhum EcoPonto foi creditado nesta coleta.";
            $badge = "0 pts";
            break;
        case "advertencia":
        default:
            $msg = "Detectamos divergência de " . $diffFmt . "% entre o peso informado e o validado na balança. "
                . "Esta é a sua ocorrência #" . $ocorrenciaNumero . ". "
                . "Fique atento: novas divergências podem gerar redução ou perda de EcoPontos.";
            break;
    }

    ecocoleta_notif_inserir(
        $conn,
        $idUsuario,
        "sistema",
        "importante",
        $titulo,
        $msg,
        $icone,
        $badge,
        "coleta_penalidade",
        $idAgendamento
    );
}

function coleta_notif_revisao_conta_coleta(
    mysqli $conn,
    int $idUsuario,
    int $idAgendamento,
    float $diferencaPercentual,
    int $ocorrenciaNumero
): void {
    if ($idUsuario <= 0 || $idAgendamento <= 0) {
        return;
    }

    $diffFmt = number_format(max(0, $diferencaPercentual), 1, ",", ".");
    $msg = "Sua conta foi colocada em revisão após divergências frequentes no peso das coletas "
        . "(ocorrência #" . $ocorrenciaNumero . ", divergência de " . $diffFmt . "% nesta coleta). "
        . "Os EcoPontos desta entrega não foram creditados. "
        . "Entre em contato com o administrador do EcoPonto para regularizar sua situação.";

    ecocoleta_notif_inserir(
        $conn,
        $idUsuario,
        "sistema",
        "importante",
        "Conta em revisão",
        $msg,
        "bell",
        "Revisão",
        "conta_revisao",
        $idAgendamento
    );
}

function coleta_notificar_morador_coleta_concluida(
    mysqli $conn,
    int $idUsuario,
    int $idAgendamento,
    int $pontosFinais,
    int $pontosAntesPenalidade,
    float $pesoValidadoKg,
    string $nomePev,
    array $avaliacao,
    int $ocorrenciaNumero
): void {
    $penalidade = (string) ($avaliacao["aplicar_penalidade"] ?? "nenhuma");
    $diffPct = (float) ($avaliacao["diferenca_percentual"] ?? 0);
    $msgAjuste = "";

    if ($penalidade === "nenhuma") {
        $msgAjuste = trim((string) ($avaliacao["mensagem_usuario"] ?? ""));
    }

    coleta_notif_coleta_concluida_admin(
        $conn,
        $idUsuario,
        $idAgendamento,
        $pontosFinais,
        $pesoValidadoKg,
        $nomePev,
        $msgAjuste
    );

    if (in_array($penalidade, ["advertencia", "reducao_20", "zero_pontos"], true)) {
        coleta_notif_penalidade_divergencia(
            $conn,
            $idUsuario,
            $idAgendamento,
            $penalidade,
            $diffPct,
            $ocorrenciaNumero,
            $pontosAntesPenalidade,
            $pontosFinais
        );
    }

    if ($penalidade === "revisao_conta") {
        coleta_notif_revisao_conta_coleta(
            $conn,
            $idUsuario,
            $idAgendamento,
            $diffPct,
            $ocorrenciaNumero
        );
    }
}

function coleta_notif_pontos_creditados(
    mysqli $conn,
    int $idUsuario,
    int $pontos,
    string $nomePev,
    string $mensagemExtra = ""
): void {
    coleta_notif_coleta_concluida_admin($conn, $idUsuario, 0, $pontos, 0, $nomePev, $mensagemExtra);
}

function coleta_validar_materiais_admin(float $pesoTotal, ?array $materiaisAdmin): array
{
    if (!is_array($materiaisAdmin) || $materiaisAdmin === []) {
        return ["ok" => false, "erro" => "Informe os materiais alocados na balança."];
    }

    $lista = [];
    $soma = 0.0;
    foreach ($materiaisAdmin as $item) {
        if (!is_array($item)) {
            continue;
        }
        $slug = ecoadm_material_slug((string) ($item["material"] ?? ""));
        $peso = round((float) ($item["peso_kg"] ?? 0), 2);
        if ($peso <= 0) {
            continue;
        }
        $lista[] = ["material" => $slug, "peso_kg" => $peso];
        $soma += $peso;
    }

    if ($lista === []) {
        return ["ok" => false, "erro" => "Selecione pelo menos um material com peso maior que zero."];
    }

    $pesoTotal = round($pesoTotal, 2);
    $soma = round($soma, 2);
    if (abs($soma - $pesoTotal) > 0.05) {
        return [
            "ok" => false,
            "erro" => "A soma dos materiais (" . number_format($soma, 2, ",", ".") .
                " kg) deve igualar o peso total na balança (" . number_format($pesoTotal, 2, ",", ".") . " kg).",
        ];
    }

    return [
        "ok" => true,
        "materiais" => $lista,
        "tipos" => array_values(array_unique(array_column($lista, "material"))),
    ];
}

function coleta_confirmar_recebimento_admin(
    mysqli $conn,
    int $idAgendamento,
    float $pesoValidadoKg,
    int $idPevAdmin,
    ?array $materiaisAdmin = null
): array {
    coleta_garantir_schema_pontuacao($conn);

    if ($idAgendamento <= 0 || $pesoValidadoKg <= 0) {
        return ["sucesso" => false, "erro" => "Informe peso validado maior que zero."];
    }

    if (ecoadm_entrega_tem_coluna($conn, "id_agendamento")) {
        $stmtDup = $conn->prepare("SELECT id_entrega FROM entrega WHERE id_agendamento = ? LIMIT 1");
        if ($stmtDup) {
            $stmtDup->bind_param("i", $idAgendamento);
            if ($stmtDup->execute() && ecocoleta_stmt_fetch_one_assoc($stmtDup)) {
                $stmtDup->close();
                return ["sucesso" => false, "erro" => "Pontos já foram creditados para esta coleta."];
            }
            $stmtDup->close();
        }
    }

    $stmtAg = $conn->prepare(
        "SELECT a.id_usuario, a.data_coleta, a.status_coleta, a.tipo_residuo,
                COALESCE(a.id_pev, 0) AS id_pev,
                COALESCE(a.peso_pendente_kg, 0) AS peso_informado_kg,
                COALESCE(NULLIF(TRIM(a.responsavel), ''), '') AS responsavel
         FROM agendamento_coleta_morador a
         WHERE a.id_agendamento = ? LIMIT 1"
    );
    if (!$stmtAg) {
        return ["sucesso" => false, "erro" => "Erro ao buscar agendamento."];
    }
    $stmtAg->bind_param("i", $idAgendamento);
    if (!$stmtAg->execute()) {
        $stmtAg->close();
        return ["sucesso" => false, "erro" => "Agendamento não encontrado."];
    }
    $ag = ecocoleta_stmt_fetch_one_assoc($stmtAg);
    $stmtAg->close();

    if (!$ag) {
        return ["sucesso" => false, "erro" => "Agendamento não encontrado."];
    }

    $statusAtual = (string) ($ag["status_coleta"] ?? "");
    if ($statusAtual === "concluida") {
        return ["sucesso" => false, "erro" => "Coleta já concluída."];
    }
    if (!in_array($statusAtual, ["pendente", "aguardando_validacao", "confirmado", "andamento"], true)) {
        return ["sucesso" => false, "erro" => "Status da coleta não permite confirmação."];
    }

    $idUsuario = (int) ($ag["id_usuario"] ?? 0);
    $idPev = (int) ($ag["id_pev"] ?? 0);
    if ($idPev <= 0) {
        $idPev = $idPevAdmin;
    }
    if ($idUsuario <= 0 || $idPev <= 0) {
        return ["sucesso" => false, "erro" => "Dados do agendamento incompletos."];
    }

    $pesoInformado = (float) ($ag["peso_informado_kg"] ?? 0);

    $validacaoMat = coleta_validar_materiais_admin($pesoValidadoKg, $materiaisAdmin);
    if (empty($validacaoMat["ok"])) {
        return ["sucesso" => false, "erro" => (string) ($validacaoMat["erro"] ?? "Materiais inválidos.")];
    }
    $materiaisValidados = $validacaoMat["materiais"] ?? [];
    $tipos = $validacaoMat["tipos"] ?? [];
    if ($tipos === []) {
        $tipos = coleta_tipos_residuo_de_storage((string) ($ag["tipo_residuo"] ?? ""));
    }

    $ocorrencias = 0;
    if (ecoadm_usuario_tem_coluna($conn, "ocorrencias_divergencia_peso")) {
        $stmtOc = $conn->prepare("SELECT COALESCE(ocorrencias_divergencia_peso, 0) AS c FROM usuario WHERE id_usuario = ? LIMIT 1");
        if ($stmtOc) {
            $stmtOc->bind_param("i", $idUsuario);
            if ($stmtOc->execute()) {
                $rowOc = ecocoleta_stmt_fetch_one_assoc($stmtOc);
                $ocorrencias = (int) ($rowOc["c"] ?? 0);
            }
            $stmtOc->close();
        }
    }

    $avaliacao = coleta_avaliar_divergencia_peso($pesoInformado, $pesoValidadoKg, $ocorrencias);
    $calc = coleta_calcular_pontos($pesoValidadoKg, $tipos, true);
    $pontosBrutos = (int) $calc["total"];
    $pontos = coleta_aplicar_penalidade_pontos($pontosBrutos, (string) $avaliacao["aplicar_penalidade"]);
    $ocorrenciaNotif = $ocorrencias;
    if (!empty($avaliacao["registrar_ocorrencia"])) {
        $ocorrenciaNotif = $ocorrencias + 1;
    }

    $nomePev = ecoadm_nome_pev_por_id($conn, $idPev);
    $dataColeta = (string) ($ag["data_coleta"] ?? date("Y-m-d"));
    $dataEntrega = $dataColeta . " " . date("H:i:s");
    $responsavelEntrega = ecoadm_resolver_responsavel_admin(
        $conn,
        $idPev,
        (string) ($ag["responsavel"] ?? ""),
        $idAgendamento
    );

    $conn->begin_transaction();
    try {
        if ($avaliacao["registrar_ocorrencia"]) {
            $novaOc = $ocorrencias + 1;
            if (ecoadm_usuario_tem_coluna($conn, "ocorrencias_divergencia_peso")) {
                $sets = "ocorrencias_divergencia_peso = ?";
                if ($avaliacao["aplicar_penalidade"] === "revisao_conta" && ecoadm_usuario_tem_coluna($conn, "conta_em_revisao")) {
                    $sets .= ", conta_em_revisao = 1";
                }
                $stmtOcUp = $conn->prepare("UPDATE usuario SET {$sets} WHERE id_usuario = ? LIMIT 1");
                if ($stmtOcUp) {
                    $stmtOcUp->bind_param("ii", $novaOc, $idUsuario);
                    $stmtOcUp->execute();
                    $stmtOcUp->close();
                }
            }
            if (ecocoleta_tabela_existe($conn, "coleta_divergencia_historico")) {
                $stmtHist = $conn->prepare(
                    "INSERT INTO coleta_divergencia_historico
                     (id_agendamento, id_usuario, peso_informado_kg, peso_validado_kg,
                      diferenca_percentual, ocorrencia_numero, penalidade)
                     VALUES (?, ?, ?, ?, ?, ?, ?)"
                );
                if ($stmtHist) {
                    $pen = (string) $avaliacao["aplicar_penalidade"];
                    $diff = (float) $avaliacao["diferenca_percentual"];
                    $stmtHist->bind_param(
                        "iidddis",
                        $idAgendamento,
                        $idUsuario,
                        $pesoInformado,
                        $pesoValidadoKg,
                        $diff,
                        $novaOc,
                        $pen
                    );
                    $stmtHist->execute();
                    $stmtHist->close();
                }
            }
        }

        $cols = "data_entrega, peso_total, pontos_gerados, id_usuario, id_pev";
        $vals = "?, ?, ?, ?, ?";
        $types = "sdiii";
        $params = [$dataEntrega, $pesoValidadoKg, $pontos, $idUsuario, $idPev];

        if (ecoadm_entrega_tem_coluna($conn, "status_material")) {
            $cols .= ", status_material";
            $vals .= ", 'coletado'";
        }
        if (ecoadm_entrega_tem_coluna($conn, "id_agendamento")) {
            $cols .= ", id_agendamento";
            $vals .= ", ?";
            $types .= "i";
            $params[] = $idAgendamento;
        }
        if (ecoadm_entrega_tem_coluna($conn, "responsavel")) {
            $cols .= ", responsavel";
            $vals .= ", ?";
            $types .= "s";
            $params[] = $responsavelEntrega;
        }

        $stmtE = $conn->prepare("INSERT INTO entrega ({$cols}) VALUES ({$vals})");
        if (!$stmtE) {
            throw new RuntimeException("prepare entrega");
        }
        $stmtE->bind_param($types, ...$params);
        if (!$stmtE->execute()) {
            $stmtE->close();
            throw new RuntimeException("insert entrega");
        }
        $idEntrega = (int) $conn->insert_id;
        $stmtE->close();

        if (
            $idEntrega > 0
            && $materiaisValidados !== []
            && ecocoleta_tabela_existe($conn, "item_entrega")
        ) {
            foreach ($materiaisValidados as $mat) {
                $pesoItem = (float) ($mat["peso_kg"] ?? 0);
                if ($pesoItem <= 0) {
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
                    throw new RuntimeException("prepare item entrega");
                }
                $stmtI->bind_param("dii", $pesoItem, $idEntrega, $idMaterial);
                if (!$stmtI->execute()) {
                    $stmtI->close();
                    throw new RuntimeException("insert item entrega");
                }
                $stmtI->close();
            }
        }

        $setsAg = ["status_coleta = 'concluida'"];
        if (ecoadm_agendamento_tem_coluna($conn, "peso_validado_kg")) {
            $setsAg[] = "peso_validado_kg = " . round($pesoValidadoKg, 2);
        }
        if (ecoadm_agendamento_tem_coluna($conn, "diferenca_percentual")) {
            $setsAg[] = "diferenca_percentual = " . (float) $avaliacao["diferenca_percentual"];
        }
        if (ecoadm_agendamento_tem_coluna($conn, "status_validacao")) {
            $stVal = (string) $avaliacao["status_validacao"];
            $setsAg[] = "status_validacao = '" . $conn->real_escape_string($stVal) . "'";
        }
        if (ecoadm_agendamento_tem_coluna($conn, "peso_status")) {
            $setsAg[] = "peso_status = 'confirmado'";
        }
        if (ecoadm_agendamento_tem_coluna($conn, "pontos_pendentes")) {
            $setsAg[] = "pontos_pendentes = " . $pontos;
        }

        $sqlAg = "UPDATE agendamento_coleta_morador SET " . implode(", ", $setsAg) .
            " WHERE id_agendamento = ? LIMIT 1";
        $stmtUp = $conn->prepare($sqlAg);
        if (!$stmtUp) {
            throw new RuntimeException("update agendamento");
        }
        $stmtUp->bind_param("i", $idAgendamento);
        if (!$stmtUp->execute()) {
            $stmtUp->close();
            throw new RuntimeException("update agendamento exec");
        }
        $stmtUp->close();

        if (ecocoleta_usuario_tem_coluna_saldo_ecopoints($conn)) {
            $novoSync = ecocoleta_obter_saldo_calculado_entrega_resgate($conn, $idUsuario);
            $stmtSaldo = $conn->prepare("UPDATE usuario SET saldo_ecopoints = ? WHERE id_usuario = ?");
            if ($stmtSaldo) {
                $stmtSaldo->bind_param("ii", $novoSync, $idUsuario);
                $stmtSaldo->execute();
                $stmtSaldo->close();
            }
        }

        coleta_atualizar_nivel_usuario($conn, $idUsuario);
        $conn->commit();

        coleta_notificar_morador_coleta_concluida(
            $conn,
            $idUsuario,
            $idAgendamento,
            $pontos,
            $pontosBrutos,
            $pesoValidadoKg,
            $nomePev,
            $avaliacao,
            $ocorrenciaNotif
        );

        ecoadm_invalidar_cache_admin();

        $nivel = coleta_calcular_nivel(ecocoleta_obter_saldo_usuario($conn, $idUsuario));

        return [
            "sucesso" => true,
            "pontos" => $pontos,
            "detalhe" => $calc["detalhe"],
            "nivel" => $nivel,
            "saldo_ecopoints" => ecocoleta_obter_saldo_usuario($conn, $idUsuario),
            "alerta_admin" => (string) ($avaliacao["alerta_admin"] ?? ""),
            "mensagem" => $pontos > 0
                ? "Recebimento confirmado. " . $pontos . " EcoPontos creditados ao morador."
                : "Recebimento confirmado sem pontuação (penalidade ou revisão).",
            "id_entrega" => $idEntrega,
        ];
    } catch (Throwable $e) {
        $conn->rollback();
        return ["sucesso" => false, "erro" => "Não foi possível confirmar o recebimento."];
    }
}
