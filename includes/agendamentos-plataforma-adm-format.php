<?php

function ecoplat_rotulo_origem_agendamento(array $row): string
{
    $nomePev = trim((string) ($row["nome_ecoponto"] ?? $row["ecoponto"] ?? ""));
    if ($nomePev !== ""
        && !in_array(mb_strtolower($nomePev, "UTF-8"), ["prefeitura", "ecoponto"], true)
    ) {
        return $nomePev;
    }

    return "—";
}

function ecoplat_rotulo_tipo_coleta(array $row): string
{
    $tipo = strtolower(trim((string) ($row["tipo"] ?? $row["tipo_coleta"] ?? "caminhao")));

    return $tipo === "prefeitura" ? "Prefeitura" : "Ecoponto";
}

function ecoplat_formatar_agendamento_item(array $row): array
{
    $slot = (int) ($row["slot_ordem"] ?? 0);
    $dataColeta = (string) ($row["data_coleta"] ?? "");
    $faixa = function_exists("ecocoleta_faixa_horario_coleta")
        ? ecocoleta_faixa_horario_coleta($slot)
        : "horário agendado";

    $horaCurta = "—";
    if (preg_match("/^(\d{2}:\d{2})/", $faixa, $m)) {
        $horaCurta = $m[1] . "h";
    }

    $dataBr = function_exists("ecoadm_formatar_data_br")
        ? ecoadm_formatar_data_br($dataColeta)
        : $dataColeta;

    $tipo = (string) ($row["tipo"] ?? $row["tipo_coleta"] ?? "caminhao");
    $nomeEcoponto = ecoplat_rotulo_origem_agendamento($row);
    $tipoLabel = ecoplat_rotulo_tipo_coleta($row);

    if (function_exists("ecoadm_rotulo_responsavel")) {
        $resp = ecoadm_rotulo_responsavel($tipo, $nomeEcoponto);
    } else {
        $resp = $tipoLabel === "Prefeitura"
            ? "Prefeitura"
            : ($nomeEcoponto !== "—" ? $nomeEcoponto : "Ecoponto");
    }

    return [
        "id_agendamento" => (int) ($row["id_agendamento"] ?? 0),
        "origem" => $nomeEcoponto,
        "nome_ecoponto" => $nomeEcoponto,
        "ecoponto" => $nomeEcoponto,
        "id_pev" => (int) ($row["id_pev"] ?? 0),
        "bairro" => (string) ($row["bairro"] ?? $row["nome_bairro"] ?? "—"),
        "horario_solicitacao" => trim($dataBr . " - " . $horaCurta, " -"),
        "responsavel" => $resp,
        "status" => (string) ($row["status"] ?? $row["status_coleta"] ?? "confirmado"),
        "tipo" => $tipo,
        "tipo_label" => $tipoLabel,
        "data_coleta" => $dataColeta,
        "slot_ordem" => $slot,
    ];
}

function ecoplat_resumo_agendamentos(array $lista): array
{
    $em = 0;
    $concl = 0;
    $canc = 0;

    foreach ($lista as $item) {
        $s = (string) ($item["status"] ?? "");
        if ($s === "concluida") {
            $concl++;
        } elseif ($s === "cancelado") {
            $canc++;
        } else {
            $em++;
        }
    }

    return [
        "total" => count($lista),
        "em_andamento" => $em,
        "concluidos" => $concl,
        "cancelados" => $canc,
    ];
}
