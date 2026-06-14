<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";

$idAdmin = ecoadm_exigir_sessao();
$ctx = ecoadm_obter_contexto($conn, $idAdmin);
$idPev = (int) $ctx["id_pev"];
$metodo = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));

function ecoadm_resposta_materiais(
    mysqli $conn,
    int $idPev,
    array $ctx,
    string $periodo,
    string $materialFiltro
): array {
    $intervalo = ecoadm_intervalo_periodo($periodo !== "" ? $periodo : "mes");
    $linhas = ecoadm_listar_linhas_materiais($conn, $idPev, $intervalo["desde"], $intervalo["ate"]);

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

    $chartLabels = [];
    $chartValues = [];
    foreach (["plastico", "papel", "vidro", "metal", "organico"] as $slug) {
        $chartLabels[] = ecoadm_material_label($slug);
        $val = 0.0;
        foreach ($agg as $a) {
            if (($a["material"] ?? "") === $slug) {
                $val = (float) ($a["total_kg"] ?? 0);
                break;
            }
        }
        $chartValues[] = $val;
    }

    $taxa = $totalKg > 0 ? (int) min(99, max(40, round(($topKg / $totalKg) * 100) + 35)) : 0;

    return [
        "linhas" => $linhas,
        "chart" => [
            "labels" => $chartLabels,
            "values" => $chartValues,
            "slugs" => ["plastico", "papel", "vidro", "metal", "organico"],
        ],
        "kpis" => [
            "total_kg" => round($totalKg, 1),
            "total_fmt" => ecoadm_formatar_peso($totalKg),
            "material_top_slug" => $topSlug,
            "material_top_slugs" => $topInfo["top_slugs"],
            "material_top_empate" => (bool) $topInfo["top_empate"],
            "material_top" => (string) $topInfo["top_label"],
            "material_top_fmt" => (string) $topInfo["top_fmt"],
            "taxa_reciclagem" => $taxa,
        ],
        "ecoponto" => $ctx["pev"],
        "admin" => [
            "nome" => (string) ($ctx["admin"]["nome"] ?? ""),
            "email" => (string) ($ctx["admin"]["email"] ?? ""),
            "ecoponto" => (string) ($ctx["pev"]["nome_ponto"] ?? ""),
        ],
    ];
}

if ($metodo === "GET") {
    $periodo = trim((string) ($_GET["periodo"] ?? "mes"));
    $materialFiltro = trim((string) ($_GET["material"] ?? ""));
    $payload = ecoadm_resposta_materiais($conn, $idPev, $ctx, $periodo, $materialFiltro);
    $payload["moradores"] = ecoadm_listar_moradores_coleta($conn);
    $payload["responsaveis"] = ecoadm_listar_responsaveis_sugeridos($conn, $idPev);
    ecoadm_json_ok($payload);
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
if ($acao !== "registrar") {
    ecoadm_json_erro("Acao invalida.");
}

$resultado = ecoadm_registrar_material_entrega($conn, $idPev, [
    "material" => trim((string) ($body["material"] ?? "")),
    "peso_kg" => $body["peso_kg"] ?? $body["peso"] ?? 0,
    "id_usuario" => (int) ($body["id_usuario"] ?? 0),
    "data_entrega" => trim((string) ($body["data_entrega"] ?? "")),
    "responsavel" => trim((string) ($body["responsavel"] ?? "")),
]);

if (empty($resultado["sucesso"])) {
    ecoadm_json_erro((string) ($resultado["erro"] ?? "Nao foi possivel registrar o material."));
}

$periodo = trim((string) ($body["periodo"] ?? "mes"));
$materialFiltro = trim((string) ($body["material_filtro"] ?? ""));
$payload = ecoadm_resposta_materiais($conn, $idPev, $ctx, $periodo, $materialFiltro);
$payload["mensagem"] = (string) ($resultado["mensagem"] ?? "Material registrado com sucesso.");
$payload["id_entrega"] = (int) ($resultado["id_entrega"] ?? 0);
$payload["linha"] = $resultado["linha"] ?? null;
$payload["moradores"] = ecoadm_listar_moradores_coleta($conn);
$payload["responsaveis"] = ecoadm_listar_responsaveis_sugeridos($conn, $idPev);

ecoadm_json_ok($payload);
