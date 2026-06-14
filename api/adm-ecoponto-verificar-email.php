<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-helpers.php";

$idAdmin = ecoadm_exigir_sessao();
ecoadm_garantir_colunas_admin($conn);

$acao = strtolower(trim((string) ($_POST["acao"] ?? "")));

$cols = "id_admin, nome, email";
if (ecoadm_admin_tem_coluna($conn, "telefone")) {
    $cols .= ", telefone";
}
$stmt = $conn->prepare("SELECT {$cols} FROM administrador_ecoponto WHERE id_admin = ? LIMIT 1");
if (!$stmt) {
    ecoadm_json_erro("Erro ao carregar administrador.");
}
$stmt->bind_param("i", $idAdmin);
if (!$stmt->execute()) {
    $stmt->close();
    ecoadm_json_erro("Erro ao carregar administrador.");
}
$admin = ecocoleta_stmt_fetch_one_assoc($stmt);
$stmt->close();

if (!$admin) {
    ecoadm_json_erro("Administrador nao encontrado.");
}

$emailAtual = trim((string) ($admin["email"] ?? ""));
$nomeAdmin = trim((string) ($admin["nome"] ?? "Administrador"));
$telefone = ecoadm_garantir_telefone_admin($conn, $idAdmin);

if ($acao === "enviar" || $acao === "reenviar") {
    $novoEmail = trim((string) ($_POST["novo_email"] ?? ""));
    $canal = strtolower(trim((string) ($_POST["canal"] ?? "email")));

    if ($acao === "reenviar") {
        $novoEmail = trim((string) ($_SESSION["ecoponto_admin_email_alt_novo"] ?? $novoEmail));
        if ($canal === "" && !empty($_SESSION["ecoponto_admin_email_alt_canal"])) {
            $canal = (string) $_SESSION["ecoponto_admin_email_alt_canal"];
        }
    }

    if ($novoEmail === "") {
        ecoadm_json_erro("Informe o novo e-mail.");
    }
    if (!filter_var($novoEmail, FILTER_VALIDATE_EMAIL)) {
        ecoadm_json_erro("Novo e-mail invalido.");
    }
    if (strcasecmp($novoEmail, $emailAtual) === 0) {
        ecoadm_json_erro("O novo e-mail deve ser diferente do atual.");
    }

    $stmtDup = $conn->prepare(
        "SELECT id_admin FROM administrador_ecoponto WHERE email = ? AND id_admin <> ? LIMIT 1"
    );
    if ($stmtDup) {
        $stmtDup->bind_param("si", $novoEmail, $idAdmin);
        if ($stmtDup->execute()) {
            $dup = ecocoleta_stmt_fetch_one_assoc($stmtDup);
            if ($dup) {
                $stmtDup->close();
                ecoadm_json_erro("Este e-mail ja esta em uso por outro administrador.");
            }
        }
        $stmtDup->close();
    }

    if (!in_array($canal, ["email", "telefone"], true)) {
        ecoadm_json_erro("Canal de envio invalido.");
    }
    if ($canal === "telefone" && strlen(ecoadm_normalizar_telefone($telefone)) < 10) {
        ecoadm_json_erro("Telefone nao cadastrado para este administrador.");
    }

    $codigo = str_pad((string) random_int(0, 999999), 6, "0", STR_PAD_LEFT);
    $hash = password_hash($codigo, PASSWORD_DEFAULT);

    $_SESSION["ecoponto_admin_email_alt_novo"] = $novoEmail;
    $_SESSION["ecoponto_admin_email_alt_hash"] = $hash;
    $_SESSION["ecoponto_admin_email_alt_expira"] = time() + 900;
    $_SESSION["ecoponto_admin_email_alt_canal"] = $canal;
    $_SESSION["ecoponto_admin_email_alt_verificado"] = false;
    $_SESSION["ecoponto_admin_email_alt_tentativas"] = 0;

    if ($canal === "email") {
        $envio = ecoadm_enviar_codigo_alteracao_email($emailAtual, $nomeAdmin, $codigo, $novoEmail);
        if (empty($envio["ok"])) {
            ecoadm_json_erro($envio["erro"] ?? "Falha ao enviar codigo por e-mail.");
        }
        $resp = [
            "mensagem" => "Codigo enviado para " . ecoadm_mascarar_email($emailAtual) . ".",
            "enviado_para" => ecoadm_mascarar_email($emailAtual),
            "canal" => "email",
        ];
        if (!empty($envio["codigo_para_teste"])) {
            $resp["codigo_para_teste"] = $envio["codigo_para_teste"];
            $resp["mensagem"] = "Modo local: use o codigo exibido nesta tela.";
        }
        ecoadm_json_ok($resp);
    }

    $envioTel = ecoadm_enviar_codigo_alteracao_telefone($telefone, $codigo);
    if (empty($envioTel["ok"])) {
        ecoadm_json_erro($envioTel["erro"] ?? "Falha ao enviar codigo por SMS.");
    }
    $resp = [
        "mensagem" => "Codigo enviado para " . ecoadm_mascarar_telefone($telefone) . ".",
        "enviado_para" => ecoadm_mascarar_telefone($telefone),
        "canal" => "telefone",
    ];
    if (!empty($envioTel["codigo_para_teste"])) {
        $resp["codigo_para_teste"] = $envioTel["codigo_para_teste"];
        $resp["mensagem"] = "Modo local: use o codigo exibido nesta tela.";
    }
    ecoadm_json_ok($resp);
}

if ($acao === "verificar") {
    $novoEmail = trim((string) ($_POST["novo_email"] ?? ""));
    $codigo = preg_replace("/\D/", "", (string) ($_POST["codigo"] ?? ""));

    if ($novoEmail === "") {
        ecoadm_json_erro("Informe o novo e-mail.");
    }
    if (strlen($codigo) !== 6) {
        ecoadm_json_erro("Digite o codigo completo (6 numeros).");
    }

    $pendente = trim((string) ($_SESSION["ecoponto_admin_email_alt_novo"] ?? ""));
    if ($pendente === "" || strcasecmp($pendente, $novoEmail) !== 0) {
        ecoadm_json_erro("Solicite um novo codigo para este e-mail.");
    }

    $hash = (string) ($_SESSION["ecoponto_admin_email_alt_hash"] ?? "");
    $expira = (int) ($_SESSION["ecoponto_admin_email_alt_expira"] ?? 0);
    $tentativas = (int) ($_SESSION["ecoponto_admin_email_alt_tentativas"] ?? 0);

    if ($hash === "" || $expira <= 0) {
        ecoadm_json_erro("Nenhum codigo pendente. Solicite o envio novamente.");
    }
    if (time() > $expira) {
        ecoadm_limpar_verificacao_email_sessao();
        ecoadm_json_erro("Codigo expirado. Solicite um novo codigo.");
    }
    if ($tentativas >= 5) {
        ecoadm_json_erro("Muitas tentativas. Solicite um novo codigo.");
    }

    if (!password_verify($codigo, $hash)) {
        $_SESSION["ecoponto_admin_email_alt_tentativas"] = $tentativas + 1;
        ecoadm_json_erro("Codigo invalido.");
    }

    $_SESSION["ecoponto_admin_email_alt_verificado"] = true;
    ecoadm_json_ok([
        "mensagem" => "E-mail verificado. Agora voce pode salvar o perfil.",
        "email_verificado" => true,
    ]);
}

ecoadm_json_erro("Acao invalida.");
