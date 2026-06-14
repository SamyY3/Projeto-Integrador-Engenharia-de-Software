<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";
require_once dirname(__DIR__) . "/includes/balanca-agendamento.php";
require_once dirname(__DIR__) . "/includes/pontuacao-coleta.php";

ecoadm_garantir_schema_integracao($conn);
coleta_garantir_schema_pontuacao($conn);

$idAdmin = ecoadm_exigir_sessao();
$ctx = ecoadm_obter_contexto($conn, $idAdmin);
$idPev = (int) $ctx["id_pev"];

$metodo = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));

if ($metodo === "GET") {
    $filtros = [
        "bairro" => trim((string) ($_GET["bairro"] ?? "")),
        "tipo" => trim((string) ($_GET["tipo"] ?? "")),
        "status" => trim((string) ($_GET["status"] ?? "")),
        "pagina" => max(1, (int) ($_GET["pagina"] ?? 1)),
    ];

    $painel = ecoadm_listar_coletas_ecoponto_painel($conn, $idPev, $filtros);
    $resumoHoje = ecoadm_resumo_coletas_hoje($conn, $idPev);

    ecoadm_json_ok([
        "coletas" => $painel["coletas"],
        "paginacao" => $painel["paginacao"],
        "bairros" => ecoadm_listar_bairros($conn),
        "moradores" => ecoadm_listar_moradores_coleta($conn),
        "responsaveis" => ecoadm_listar_responsaveis_sugeridos($conn, $idPev),
        "resumo_hoje" => $resumoHoje,
        "ecoponto" => $ctx["pev"],
        "admin" => [
            "nome" => (string) ($ctx["admin"]["nome"] ?? ""),
            "email" => (string) ($ctx["admin"]["email"] ?? ""),
            "ecoponto" => (string) ($ctx["pev"]["nome_ponto"] ?? ""),
        ],
    ]);
}

if ($metodo !== "POST") {
    ecoadm_json_erro("Metodo nao permitido.", 405);
}

$body = $_POST;
if (empty($body) && ($raw = file_get_contents("php://input"))) {
    $json = json_decode($raw, true);
    if (is_array($json)) {
        $body = $json;
    }
}

$acao = trim((string) ($body["acao"] ?? ""));
$idAgendamento = (int) ($body["id_agendamento"] ?? 0);

if ($acao === "nova" || $acao === "criar_coleta") {
    $resultado = ecoadm_criar_agendamento_adm($conn, $idPev, [
        "id_usuario" => (int) ($body["id_usuario"] ?? 0),
        "data_coleta" => trim((string) ($body["data_coleta"] ?? "")),
        "slot_ordem" => (int) ($body["slot_ordem"] ?? 0),
        "tipo" => trim((string) ($body["tipo"] ?? "caminhao")),
        "status" => trim((string) ($body["status"] ?? "confirmado")),
    ]);
    if (empty($resultado["sucesso"])) {
        ecoadm_json_erro((string) ($resultado["erro"] ?? "Nao foi possivel criar a coleta."));
    }
    $painelNova = ecoadm_listar_coletas_ecoponto_painel($conn, $idPev, ["pagina" => 1]);
    ecoadm_json_ok([
        "mensagem" => "Nova coleta registrada com sucesso.",
        "id_agendamento" => (int) ($resultado["id_agendamento"] ?? 0),
        "coletas" => $painelNova["coletas"],
        "paginacao" => $painelNova["paginacao"],
        "resumo_hoje" => ecoadm_resumo_coletas_hoje($conn, $idPev),
    ]);
}

if ($idAgendamento <= 0) {
    ecoadm_json_erro("Informe id_agendamento.");
}

$campos = [];

if ($acao === "confirmar_recebimento" || $acao === "confirmar_recebimento_coleta") {
    $pesoValidado = round((float) ($body["peso_validado_kg"] ?? $body["peso_validado"] ?? 0), 2);
    $materiaisAdmin = null;
    if (isset($body["materiais"])) {
        if (is_string($body["materiais"])) {
            $decoded = json_decode($body["materiais"], true);
            $materiaisAdmin = is_array($decoded) ? $decoded : null;
        } elseif (is_array($body["materiais"])) {
            $materiaisAdmin = $body["materiais"];
        }
    }
    $resultado = coleta_confirmar_recebimento_admin($conn, $idAgendamento, $pesoValidado, $idPev, $materiaisAdmin);
    if (empty($resultado["sucesso"])) {
        ecoadm_json_erro((string) ($resultado["erro"] ?? "Nao foi possivel confirmar o recebimento."));
    }
    $paginaAtual = max(1, (int) ($body["pagina"] ?? 1));
    $painelAtual = ecoadm_listar_coletas_ecoponto_painel($conn, $idPev, ["pagina" => $paginaAtual]);
    ecoadm_json_ok([
        "mensagem" => (string) ($resultado["mensagem"] ?? "Recebimento confirmado."),
        "pontos" => (int) ($resultado["pontos"] ?? 0),
        "detalhe" => $resultado["detalhe"] ?? [],
        "alerta_admin" => (string) ($resultado["alerta_admin"] ?? ""),
        "coletas" => $painelAtual["coletas"],
        "paginacao" => $painelAtual["paginacao"],
        "resumo_hoje" => ecoadm_resumo_coletas_hoje($conn, $idPev),
    ]);
} elseif ($acao === "concluir" || $acao === "marcar_concluida") {
    ecoadm_json_erro("Use a acao confirmar_recebimento informando o peso validado na balanca.");
} elseif ($acao === "status") {
    $status = trim((string) ($body["status"] ?? ""));
    if ($status === "concluida") {
        ecoadm_json_erro(
            "Para concluir a coleta, use Marcar como concluida informando o peso e os materiais validados na balanca."
        );
    }
    if (!in_array($status, ["pendente", "aguardando_validacao", "confirmado", "andamento"], true)) {
        ecoadm_json_erro("Status invalido.");
    }
    $campos["status"] = $status;
} elseif ($acao === "responsavel" || $acao === "atribuir_responsavel") {
    $nomeResp = trim((string) ($body["responsavel"] ?? ""));
    if ($nomeResp === "") {
        ecoadm_json_erro("Selecione o responsavel pela coleta.");
    }
    $campos["responsavel_nome"] = $nomeResp;
    $campos["tipo"] = "caminhao";
    $campos["id_pev"] = $idPev;
} elseif ($acao === "tipo") {
    $tipo = trim((string) ($body["tipo"] ?? ""));
    if (!in_array($tipo, ["caminhao", "prefeitura"], true)) {
        ecoadm_json_erro("Tipo de coleta invalido.");
    }
    $campos["tipo"] = $tipo;
    $campos["id_pev"] = $idPev;
    $campos["responsavel"] = "1";
} else {
    ecoadm_json_erro("Acao invalida.");
}

if (!ecoadm_atualizar_coleta($conn, $idAgendamento, $campos)) {
    ecoadm_json_erro("Nao foi possivel atualizar a coleta.");
}

$paginaAtual = max(1, (int) ($body["pagina"] ?? 1));
$painelAtual = ecoadm_listar_coletas_ecoponto_painel($conn, $idPev, ["pagina" => $paginaAtual]);

$mensagem = "Coleta atualizada com sucesso.";
if (
    ($acao === "concluir" || $acao === "marcar_concluida")
    || ($acao === "status" && ($campos["status"] ?? "") === "concluida")
) {
    $mensagem = "Coleta concluida. Os materiais foram registrados na pagina de Materiais.";
}

ecoadm_json_ok([
    "mensagem" => $mensagem,
    "coletas" => $painelAtual["coletas"],
    "paginacao" => $painelAtual["paginacao"],
    "resumo_hoje" => ecoadm_resumo_coletas_hoje($conn, $idPev),
]);
