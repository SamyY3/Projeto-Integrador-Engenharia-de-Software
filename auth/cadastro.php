<?php

ini_set("display_errors", "0");
error_reporting(0);

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/email_helper.php";
require_once dirname(__DIR__) . "/includes/senha-validacao.php";
require_once dirname(__DIR__) . "/ecocheck/ecocheck-lib.php";

ecocheck_iniciar_sessao();
ecocheck_exigir_token();

try {
    $nome  = trim((string) ($_POST["nome"]  ?? ""));
    $email = trim((string) ($_POST["email"] ?? ""));
    $senha = (string) ($_POST["senha"] ?? "");

    if ($nome === "" || $email === "" || $senha === "") {
        echo json_encode(["erro" => "Preencha todos os campos"], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(["erro" => "E-mail invalido"], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (strlen($senha) < 8 || strlen($senha) > 16) {
        echo json_encode(["erro" => "A senha deve ter entre 8 e 16 caracteres"], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (ecocoleta_senha_tem_numeros_sequenciais($senha)) {
        echo json_encode(["erro" => "A senha não pode conter números sequenciais (ex.: 1234)"], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $conn->prepare("SELECT id_usuario FROM usuario WHERE email = ? LIMIT 1");
    if (!$stmt) {
        echo json_encode(["erro" => "Erro ao preparar consulta"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("s", $email);
    if (!$stmt->execute()) {
        $stmt->close();
        echo json_encode(["erro" => "Erro ao consultar usuarios"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (ecocoleta_stmt_num_rows($stmt) > 0) {
        $stmt->close();
        echo json_encode(["erro" => "E-mail ja cadastrado. Faca login."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->close();

    $codigo = str_pad((string) random_int(0, 999999), 6, "0", STR_PAD_LEFT);
    $codigoHash = password_hash($codigo, PASSWORD_DEFAULT);
    $senhaHash  = password_hash($senha, PASSWORD_DEFAULT);

    $sqlUp = "INSERT INTO cadastro_pendente
                (nome, email, senha_hash, codigo_hash, codigo_expira, tentativas, criado_em)
              VALUES
                (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), 0, NOW())
              ON DUPLICATE KEY UPDATE
                nome = VALUES(nome),
                senha_hash = VALUES(senha_hash),
                codigo_hash = VALUES(codigo_hash),
                codigo_expira = VALUES(codigo_expira),
                tentativas = 0,
                criado_em = NOW()";
    $stmtUp = $conn->prepare($sqlUp);
    if (!$stmtUp) {
        echo json_encode([
            "erro" => "Erro ao preparar cadastro pendente. Rode INSTALAR-BANCO.bat para garantir que a tabela cadastro_pendente existe.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmtUp->bind_param("ssss", $nome, $email, $senhaHash, $codigoHash);
    if (!$stmtUp->execute()) {
        $err = $conn->error;
        $stmtUp->close();
        if (stripos($err, "doesn't exist") !== false || stripos($err, "Unknown table") !== false) {
            echo json_encode([
                "erro" => "A tabela cadastro_pendente nao existe. Rode INSTALAR-BANCO.bat.",
            ], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(["erro" => "Erro ao salvar cadastro pendente."], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }
    $stmtUp->close();

    $cfg = ecocoleta_carregar_smtp_settings(dirname(__DIR__) . "/config");
    if (isset($cfg["erro"])) {
        echo json_encode([
            "erro" => "Cadastro pendente foi salvo, mas houve problema no e-mail: " . $cfg["erro"],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $modoLocal = ecocoleta_deve_usar_email_local($cfg);

    $resposta = [
        "sucesso" => true,
        "mensagem" => "Enviamos um codigo de 6 digitos para seu e-mail. Verifique a caixa de entrada e o spam.",
        "email" => $email,
    ];

    if ($modoLocal) {
        $resposta["mensagem"] = "Modo local (XAMPP): o codigo de 6 digitos aparece na proxima tela. Nao e necessario e-mail.";
        $resposta["codigo_para_teste"] = $codigo;
        echo json_encode($resposta, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $envio = ecocoleta_enviar_codigo_por_email(
        $cfg,
        $email,
        $nome,
        $codigo,
        "EcoColeta - codigo para confirmar seu cadastro",
        "Use o codigo abaixo para confirmar seu cadastro no EcoColeta."
    );

    if (empty($envio["ok"])) {
        echo json_encode([
            "erro" => $envio["erro"] ?? "Falha ao enviar o e-mail. Tente novamente em alguns segundos.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode($resposta, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    $payload = ["erro" => "Erro no servidor ao processar cadastro."];
    if (function_exists("ecocoleta_request_localhost") && ecocoleta_request_localhost()) {
        $payload["detalhe"] = $e->getMessage();
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
}
