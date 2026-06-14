<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-data.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-helpers.php";

$idAdmin = ecoplat_exigir_sessao();
ecoplat_garantir_colunas_admin($conn);

$acao = strtolower(trim((string) ($_POST["acao"] ?? "")));

$stmt = $conn->prepare(
    "SELECT id_admin, nome, email FROM administrador_plataforma WHERE id_admin = ? AND status = 'ativo' LIMIT 1"
);
if (!$stmt) {
    ecoplat_json_erro("Erro ao carregar administrador.");
}
$stmt->bind_param("i", $idAdmin);
if (!$stmt->execute()) {
    $stmt->close();
    ecoplat_json_erro("Erro ao carregar administrador.");
}
$admin = ecocoleta_stmt_fetch_one_assoc($stmt);
$stmt->close();

if (!$admin) {
    ecoplat_json_erro("Administrador nao encontrado.");
}

$emailAtual = trim((string) ($admin["email"] ?? ""));
$nomeAdmin = trim((string) ($admin["nome"] ?? "Administrador"));

if ($acao === "enviar" || $acao === "reenviar") {
    $novoEmail = trim((string) ($_POST["novo_email"] ?? ""));

    if ($acao === "reenviar") {
        $novoEmail = trim((string) ($_SESSION["ecoplat_admin_email_alt_novo"] ?? $novoEmail));
    }

    if ($novoEmail === "") {
        ecoplat_json_erro("Informe o novo e-mail.");
    }
    if (!filter_var($novoEmail, FILTER_VALIDATE_EMAIL)) {
        ecoplat_json_erro("Novo e-mail invalido.");
    }
    if (strcasecmp($novoEmail, $emailAtual) === 0) {
        ecoplat_json_erro("O novo e-mail deve ser diferente do atual.");
    }

    $stmtDup = $conn->prepare(
        "SELECT id_admin FROM administrador_plataforma WHERE email = ? AND id_admin <> ? LIMIT 1"
    );
    if ($stmtDup) {
        $stmtDup->bind_param("si", $novoEmail, $idAdmin);
        if ($stmtDup->execute()) {
            $dup = ecocoleta_stmt_fetch_one_assoc($stmtDup);
            if ($dup) {
                $stmtDup->close();
                ecoplat_json_erro("Este e-mail ja esta em uso.");
            }
        }
        $stmtDup->close();
    }

    $codigo = str_pad((string) random_int(0, 999999), 6, "0", STR_PAD_LEFT);
    $hash = password_hash($codigo, PASSWORD_DEFAULT);

    $_SESSION["ecoplat_admin_email_alt_novo"] = $novoEmail;
    $_SESSION["ecoplat_admin_email_alt_hash"] = $hash;
    $_SESSION["ecoplat_admin_email_alt_expira"] = time() + 900;
    $_SESSION["ecoplat_admin_email_alt_canal"] = "email";
    $_SESSION["ecoplat_admin_email_alt_verificado"] = false;
    $_SESSION["ecoplat_admin_email_alt_tentativas"] = 0;

    $envio = ecoadm_enviar_codigo_alteracao_email($emailAtual, $nomeAdmin, $codigo, $novoEmail);
    if (empty($envio["ok"])) {
        ecoplat_json_erro($envio["erro"] ?? "Falha ao enviar codigo por e-mail.");
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
    ecoplat_json_ok($resp);
}

if ($acao === "verificar") {
    $novoEmail = trim((string) ($_POST["novo_email"] ?? ""));
    $codigo = preg_replace("/\D/", "", (string) ($_POST["codigo"] ?? ""));

    if ($novoEmail === "") {
        ecoplat_json_erro("Informe o novo e-mail.");
    }
    if (strlen($codigo) !== 6) {
        ecoplat_json_erro("Digite o codigo completo (6 numeros).");
    }

    $pendente = trim((string) ($_SESSION["ecoplat_admin_email_alt_novo"] ?? ""));
    if ($pendente === "" || strcasecmp($pendente, $novoEmail) !== 0) {
        ecoplat_json_erro("Solicite um novo codigo para este e-mail.");
    }

    $hash = (string) ($_SESSION["ecoplat_admin_email_alt_hash"] ?? "");
    $expira = (int) ($_SESSION["ecoplat_admin_email_alt_expira"] ?? 0);
    $tentativas = (int) ($_SESSION["ecoplat_admin_email_alt_tentativas"] ?? 0);

    if ($hash === "" || $expira <= 0) {
        ecoplat_json_erro("Nenhum codigo pendente. Solicite o envio novamente.");
    }
    if (time() > $expira) {
        ecoplat_limpar_verificacao_email_sessao();
        ecoplat_json_erro("Codigo expirado. Solicite um novo codigo.");
    }
    if ($tentativas >= 5) {
        ecoplat_json_erro("Muitas tentativas. Solicite um novo codigo.");
    }

    if (!password_verify($codigo, $hash)) {
        $_SESSION["ecoplat_admin_email_alt_tentativas"] = $tentativas + 1;
        ecoplat_json_erro("Codigo invalido.");
    }

    $_SESSION["ecoplat_admin_email_alt_verificado"] = true;
    ecoplat_json_ok([
        "mensagem" => "E-mail verificado. Agora voce pode salvar o perfil.",
        "email_verificado" => true,
    ]);
}

ecoplat_json_erro("Acao invalida.");
