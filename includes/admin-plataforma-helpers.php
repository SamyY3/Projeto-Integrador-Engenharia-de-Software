<?php

require_once __DIR__ . "/stmt_helpers.php";

function ecoplat_json_erro(string $msg, int $code = 200): void
{
    http_response_code($code);
    echo json_encode(["sucesso" => false, "erro" => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function ecoplat_json_ok(array $payload = []): void
{
    echo json_encode(array_merge(["sucesso" => true], $payload), JSON_UNESCAPED_UNICODE);
    exit;
}

function ecoplat_exigir_sessao(): int
{
    if (empty($_SESSION["ecocoleta_plat_admin_id"]) || (int) $_SESSION["ecocoleta_plat_admin_id"] <= 0) {
        ecoplat_json_erro("Sessao da plataforma expirada. Faca login novamente.");
    }
    return (int) $_SESSION["ecocoleta_plat_admin_id"];
}

function ecoplat_encerrar_sessao(): void
{
    if (!function_exists("ecocheck_limpar_verificacao_sessao")) {
        require_once dirname(__DIR__) . "/ecocheck/ecocheck-lib.php";
    }
    ecocheck_limpar_verificacao_sessao();

    unset(
        $_SESSION["ecocoleta_plat_admin_id"],
        $_SESSION["ecocoleta_plat_admin_nome"],
        $_SESSION["ecocoleta_plat_admin_email"],
        $_SESSION["ecocoleta_plat_admin_cargo"],
        $_SESSION["ecocoleta_plat_admin_foto"]
    );
}

function ecoplat_limpar_verificacao_email_sessao(): void
{
    unset(
        $_SESSION["ecoplat_admin_email_alt_novo"],
        $_SESSION["ecoplat_admin_email_alt_hash"],
        $_SESSION["ecoplat_admin_email_alt_expira"],
        $_SESSION["ecoplat_admin_email_alt_canal"],
        $_SESSION["ecoplat_admin_email_alt_verificado"],
        $_SESSION["ecoplat_admin_email_alt_tentativas"]
    );
}

function ecoplat_email_alteracao_verificada(string $novoEmail): bool
{
    if (empty($_SESSION["ecoplat_admin_email_alt_verificado"])) {
        return false;
    }
    $pendente = trim((string) ($_SESSION["ecoplat_admin_email_alt_novo"] ?? ""));

    return $pendente !== "" && strcasecmp($pendente, trim($novoEmail)) === 0;
}

function ecoplat_exigir_verificacao_troca_email(mysqli $conn, int $idAdmin, string $emailAtual, string $emailNovo): void
{
    $emailAtual = trim($emailAtual);
    $emailNovo = trim($emailNovo);
    if ($emailNovo === "" || strcasecmp($emailAtual, $emailNovo) === 0) {
        return;
    }

    if (!ecoplat_email_alteracao_verificada($emailNovo)) {
        ecoplat_json_erro(
            "Para alterar o e-mail, confirme o codigo enviado ao e-mail atual."
        );
    }

    $stmt = $conn->prepare(
        "SELECT id_admin FROM administrador_plataforma WHERE email = ? AND id_admin <> ? LIMIT 1"
    );
    if ($stmt) {
        $stmt->bind_param("si", $emailNovo, $idAdmin);
        if ($stmt->execute()) {
            $row = ecocoleta_stmt_fetch_one_assoc($stmt);
            if ($row) {
                $stmt->close();
                ecoplat_json_erro("Este e-mail ja esta em uso.");
            }
        }
        $stmt->close();
    }
}

function ecoplat_validar_email_senha_perfil(): array
{
    $email = trim((string) ($_POST["email"] ?? ""));
    $confirmEmail = trim((string) ($_POST["confirmaremail"] ?? ""));
    $senha = (string) ($_POST["senha"] ?? "");
    $confirmSenha = (string) ($_POST["confirmarsenha"] ?? "");

    if ($email === "" || $confirmEmail === "") {
        ecoplat_json_erro("Preencha o e-mail e a confirmacao.");
    }
    if ($email !== $confirmEmail) {
        ecoplat_json_erro("Os e-mails nao coincidem.");
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        ecoplat_json_erro("E-mail invalido.");
    }
    if ($senha !== $confirmSenha) {
        ecoplat_json_erro("As senhas nao coincidem.");
    }
    if ($senha !== "" && strlen($senha) < 8) {
        ecoplat_json_erro("Senha deve ter pelo menos 8 caracteres.");
    }
    if ($senha !== "" && !preg_match("/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/", $senha)) {
        ecoplat_json_erro("Senha deve conter maiuscula, minuscula e numero.");
    }

    return [$email, $senha];
}

function ecoplat_payload_sessao(): array
{
    $payload = [
        "id" => (int) ($_SESSION["ecocoleta_plat_admin_id"] ?? 0),
        "nome" => (string) ($_SESSION["ecocoleta_plat_admin_nome"] ?? "Administrador"),
        "email" => (string) ($_SESSION["ecocoleta_plat_admin_email"] ?? ""),
        "cargo" => (string) ($_SESSION["ecocoleta_plat_admin_cargo"] ?? "Administrador da plataforma"),
    ];
    if (!empty($_SESSION["ecocoleta_plat_admin_foto"])) {
        $payload["foto_perfil"] = (string) $_SESSION["ecocoleta_plat_admin_foto"];
    }

    return $payload;
}
