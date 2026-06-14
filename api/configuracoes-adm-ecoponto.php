<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";

$idAdmin = ecoadm_exigir_sessao();
ecoadm_garantir_colunas_admin($conn);
$ctx = ecoadm_obter_contexto($conn, $idAdmin);
$idPev = (int) ($ctx["id_pev"] ?? 0);
$nomeEco = (string) ($ctx["pev"]["nome_ponto"] ?? $ctx["admin"]["nome_ecoponto"] ?? "");

if (!ecoadm_admin_tem_coluna($conn, "preferencias_json")) {
    ecoadm_json_erro("Coluna de preferencias indisponivel no banco.");
}

$metodo = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));

if ($metodo === "GET") {
    $stmt = $conn->prepare(
        "SELECT preferencias_json FROM administrador_ecoponto WHERE id_admin = ? LIMIT 1"
    );
    if (!$stmt) {
        ecoadm_json_erro("Erro ao carregar preferencias.");
    }
    $stmt->bind_param("i", $idAdmin);
    if (!$stmt->execute()) {
        $stmt->close();
        ecoadm_json_erro("Erro ao consultar preferencias.");
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    $preferencias = ecoadm_preferencias_padrao();
    if ($row && !empty($row["preferencias_json"])) {
        $decoded = json_decode((string) $row["preferencias_json"], true);
        $preferencias = ecoadm_normalizar_preferencias($decoded);
    }

    $bairros = ecoadm_listar_bairros_ativos_pev($conn, $idPev);
    if (
        empty($preferencias["areas_atendidas"])
        || $preferencias["areas_atendidas"] === ecoadm_preferencias_padrao()["areas_atendidas"]
    ) {
        if ($bairros !== []) {
            $preferencias["areas_atendidas"] = array_slice($bairros, 0, 12);
        }
    }

    ecoadm_json_ok([
        "preferencias" => $preferencias,
        "administradores" => ecoadm_listar_administradores_pev(
            $conn,
            $idPev,
            $nomeEco,
            $idAdmin
        ),
        "bairros_disponiveis" => $bairros,
        "ecoponto" => $ctx["pev"],
        "mensagem" => "Preferencias carregadas.",
    ]);
}

if ($metodo !== "POST") {
    ecoadm_json_erro("Metodo nao permitido.", 405);
}

$preferenciasExistentes = ecoadm_preferencias_padrao();
$stmtLoad = $conn->prepare(
    "SELECT preferencias_json FROM administrador_ecoponto WHERE id_admin = ? LIMIT 1"
);
if ($stmtLoad) {
    $stmtLoad->bind_param("i", $idAdmin);
    if ($stmtLoad->execute()) {
        $rowLoad = ecocoleta_stmt_fetch_one_assoc($stmtLoad);
        if ($rowLoad && !empty($rowLoad["preferencias_json"])) {
            $decoded = json_decode((string) $rowLoad["preferencias_json"], true);
            $preferenciasExistentes = ecoadm_normalizar_preferencias($decoded);
        }
    }
    $stmtLoad->close();
}

$body = $_POST;
if (empty($body) && ($raw = file_get_contents("php://input"))) {
    $json = json_decode($raw, true);
    if (is_array($json)) {
        $body = $json;
    }
}

$merge = array_merge($preferenciasExistentes, array_filter([
    "idioma" => isset($body["idioma"]) ? (string) $body["idioma"] : null,
    "tema" => isset($body["tema"]) ? (string) $body["tema"] : null,
    "horarios" => isset($body["horarios"]) ? (string) $body["horarios"] : null,
    "tipo_coleta" => isset($body["tipo_coleta"])
        ? (string) $body["tipo_coleta"]
        : (isset($body["tipoColeta"]) ? (string) $body["tipoColeta"] : null),
], static fn ($v) => $v !== null && $v !== ""));

if (isset($body["notificacoes"])) {
    $merge["notificacoes"] = filter_var($body["notificacoes"], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($merge["notificacoes"] === null) {
        $merge["notificacoes"] = (bool) $body["notificacoes"];
    }
}
if (isset($body["dois_fatores"])) {
    $merge["dois_fatores"] = filter_var($body["dois_fatores"], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($merge["dois_fatores"] === null) {
        $merge["dois_fatores"] = (bool) $body["dois_fatores"];
    }
} elseif (isset($body["doisFatores"])) {
    $merge["dois_fatores"] = filter_var($body["doisFatores"], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($merge["dois_fatores"] === null) {
        $merge["dois_fatores"] = (bool) $body["doisFatores"];
    }
}
if (isset($body["areas_atendidas"])) {
    $areasRaw = $body["areas_atendidas"];
    if (is_string($areasRaw)) {
        $areasRaw = json_decode($areasRaw, true);
    }
    if (is_array($areasRaw)) {
        $merge["areas_atendidas"] = $areasRaw;
    }
}

$preferencias = ecoadm_normalizar_preferencias($merge);

$jsonStr = json_encode($preferencias, JSON_UNESCAPED_UNICODE);
if ($jsonStr === false) {
    ecoadm_json_erro("Erro ao serializar preferencias.");
}

$stmt = $conn->prepare(
    "UPDATE administrador_ecoponto SET preferencias_json = ? WHERE id_admin = ? LIMIT 1"
);
if (!$stmt) {
    ecoadm_json_erro("Erro ao preparar gravacao das preferencias.");
}
$stmt->bind_param("si", $jsonStr, $idAdmin);
if (!$stmt->execute()) {
    $stmt->close();
    ecoadm_json_erro("Nao foi possivel salvar as preferencias.");
}
$stmt->close();

ecoadm_json_ok([
    "preferencias" => $preferencias,
    "mensagem" => "Preferencias salvas com sucesso.",
]);
