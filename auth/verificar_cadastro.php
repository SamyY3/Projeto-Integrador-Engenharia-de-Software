<?php

ini_set("display_errors", "0");
error_reporting(0);

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/email_helper.php";

try {
    $acao  = trim((string) ($_POST["acao"]  ?? "verificar"));
    $email = trim((string) ($_POST["email"] ?? ""));

    if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(["sucesso" => false, "erro" => "E-mail invalido"], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($acao === "reenviar") {
        $stmt = $conn->prepare(
            "SELECT id_cadastro_pendente, nome FROM cadastro_pendente WHERE email = ? LIMIT 1"
        );
        if (!$stmt) {
            echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $stmt->bind_param("s", $email);
        if (!$stmt->execute()) {
            $stmt->close();
            echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $row = ecocoleta_stmt_fetch_one_assoc($stmt);
        $stmt->close();
        if (!$row) {
            echo json_encode([
                "sucesso" => false,
                "erro" => "Nenhum cadastro pendente para esse e-mail. Volte e preencha o formulario.",
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $idPend = (int) $row["id_cadastro_pendente"];
        $nome = (string) $row["nome"];

        $codigo = str_pad((string) random_int(0, 999999), 6, "0", STR_PAD_LEFT);
        $codigoHash = password_hash($codigo, PASSWORD_DEFAULT);

        $stmtUp = $conn->prepare(
            "UPDATE cadastro_pendente
             SET codigo_hash = ?,
                 codigo_expira = DATE_ADD(NOW(), INTERVAL 15 MINUTE),
                 tentativas = 0
             WHERE id_cadastro_pendente = ?"
        );
        if (!$stmtUp) {
            echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $stmtUp->bind_param("si", $codigoHash, $idPend);
        if (!$stmtUp->execute()) {
            $stmtUp->close();
            echo json_encode(["sucesso" => false, "erro" => "Erro ao gerar novo codigo"], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $stmtUp->close();

        $cfg = ecocoleta_carregar_smtp_settings(dirname(__DIR__) . "/config");
        if (isset($cfg["erro"])) {
            echo json_encode(["sucesso" => false, "erro" => $cfg["erro"]], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $modoLocal = ecocoleta_deve_usar_email_local($cfg);
        $resp = ["sucesso" => true, "mensagem" => "Codigo reenviado. Verifique seu e-mail."];
        if ($modoLocal) {
            $resp["mensagem"] = "Modo local (XAMPP): o codigo aparece nesta tela.";
            $resp["codigo_para_teste"] = $codigo;
            echo json_encode($resp, JSON_UNESCAPED_UNICODE);
            exit;
        }

        $envio = ecocoleta_enviar_codigo_por_email(
            $cfg,
            $email,
            $nome,
            $codigo,
            "EcoColeta - novo codigo de cadastro",
            "Voce solicitou um novo codigo para confirmar seu cadastro no EcoColeta."
        );
        if (empty($envio["ok"])) {
            echo json_encode(["sucesso" => false, "erro" => $envio["erro"] ?? "Falha ao reenviar e-mail"], JSON_UNESCAPED_UNICODE);
            exit;
        }
        echo json_encode($resp, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $codigo = preg_replace("/\D/", "", (string) ($_POST["codigo"] ?? ""));
    if (strlen($codigo) !== 6) {
        echo json_encode(["sucesso" => false, "erro" => "Digite o codigo completo (6 numeros)"], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $conn->prepare(
        "SELECT id_cadastro_pendente, nome, senha_hash, codigo_hash, tentativas,
                (codigo_expira IS NOT NULL AND codigo_expira > NOW()) AS prazo_ok
         FROM cadastro_pendente
         WHERE email = ? LIMIT 1"
    );
    if (!$stmt) {
        echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("s", $email);
    if (!$stmt->execute()) {
        $stmt->close();
        echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    if (!$row) {
        echo json_encode([
            "sucesso" => false,
            "erro" => "Nenhum cadastro pendente para esse e-mail. Volte e preencha o formulario.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $tentativas = (int) ($row["tentativas"] ?? 0);
    if ($tentativas >= 5) {
        echo json_encode([
            "sucesso" => false,
            "erro" => "Muitas tentativas erradas. Volte e peca outro codigo (reenviar).",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $hash = (string) ($row["codigo_hash"] ?? "");
    if ($hash === "" || !password_verify($codigo, $hash)) {

        $idPend = (int) $row["id_cadastro_pendente"];
        $stmtT = $conn->prepare("UPDATE cadastro_pendente SET tentativas = tentativas + 1 WHERE id_cadastro_pendente = ?");
        if ($stmtT) {
            $stmtT->bind_param("i", $idPend);
            $stmtT->execute();
            $stmtT->close();
        }
        echo json_encode(["sucesso" => false, "erro" => "Codigo invalido"], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ((int) ($row["prazo_ok"] ?? 0) !== 1) {
        echo json_encode([
            "sucesso" => false,
            "erro" => "Codigo expirado. Clique em Reenviar agora para receber um novo.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmtJa = $conn->prepare("SELECT id_usuario FROM usuario WHERE email = ? LIMIT 1");
    if ($stmtJa) {
        $stmtJa->bind_param("s", $email);
        if ($stmtJa->execute() && ecocoleta_stmt_num_rows($stmtJa) > 0) {
            $stmtJa->close();
            $stmtDel = $conn->prepare("DELETE FROM cadastro_pendente WHERE email = ?");
            if ($stmtDel) {
                $stmtDel->bind_param("s", $email);
                $stmtDel->execute();
                $stmtDel->close();
            }
            echo json_encode([
                "sucesso" => false,
                "erro" => "E-mail ja cadastrado. Faca login.",
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $stmtJa->close();
    }

    $nome = (string) $row["nome"];
    $senhaHash = (string) $row["senha_hash"];
    $tipo = "morador";
    $stmtIns = $conn->prepare(
        "INSERT INTO usuario (nome, email, senha_hash, tipo_usuario) VALUES (?, ?, ?, ?)"
    );
    if (!$stmtIns) {
        echo json_encode(["sucesso" => false, "erro" => "Erro ao preparar criacao de conta"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmtIns->bind_param("ssss", $nome, $email, $senhaHash, $tipo);
    if (!$stmtIns->execute()) {
        $stmtIns->close();
        echo json_encode(["sucesso" => false, "erro" => "Erro ao criar conta"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmtIns->close();

    $stmtDel = $conn->prepare("DELETE FROM cadastro_pendente WHERE email = ?");
    if ($stmtDel) {
        $stmtDel->bind_param("s", $email);
        $stmtDel->execute();
        $stmtDel->close();
    }

    echo json_encode([
        "sucesso" => true,
        "mensagem" => "Conta confirmada com sucesso! Faca login para continuar.",
        "email" => $email,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Erro no servidor ao verificar codigo.",
    ], JSON_UNESCAPED_UNICODE);
}
