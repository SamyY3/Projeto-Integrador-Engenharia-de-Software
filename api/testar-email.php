<?php

ini_set("display_errors", "0");
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/email_helper.php";

if (!ecocoleta_request_localhost()) {
    http_response_code(403);
    echo json_encode(["erro" => "Disponivel apenas em localhost."], JSON_UNESCAPED_UNICODE);
    exit;
}

$destino = trim((string) ($_GET["email"] ?? ""));
if ($destino === "" || !filter_var($destino, FILTER_VALIDATE_EMAIL)) {
    echo json_encode([
        "erro" => "Informe ?email=seu@email.com na URL.",
        "phpmailer_instalado" => ecocoleta_phpmailer_disponivel(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$cfg = ecocoleta_carregar_smtp_settings(dirname(__DIR__) . "/config");
if (isset($cfg["erro"])) {
    echo json_encode(["erro" => $cfg["erro"], "phpmailer_instalado" => ecocoleta_phpmailer_disponivel()], JSON_UNESCAPED_UNICODE);
    exit;
}

$codigo = "123456";
$envio = ecocoleta_enviar_codigo_por_email(
    $cfg,
    $destino,
    "Teste EcoColeta",
    $codigo,
    "EcoColeta - teste de e-mail",
    "Se voce recebeu este e-mail, o SMTP esta configurado corretamente."
);

echo json_encode(array_merge(
    [
        "phpmailer_instalado" => true,
        "modo_local_sem_email" => !empty($cfg["modo_local_sem_email"]),
    ],
    $envio
), JSON_UNESCAPED_UNICODE);
