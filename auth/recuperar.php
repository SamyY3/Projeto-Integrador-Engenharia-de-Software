<?php
ini_set("display_errors", "0");
error_reporting(0);

$codigoPost = preg_replace("/\D/", "", (string) ($_POST["codigo"] ?? ""));
$emailPost = trim((string) ($_POST["email"] ?? ""));
if (strlen($codigoPost) === 6 && $emailPost !== "") {
    header("Content-Type: application/json; charset=utf-8");
    header("Cache-Control: no-store, no-cache, must-revalidate");
    require_once dirname(__DIR__) . "/includes/conexao.php";
    $email = $emailPost;
    $codigo = $codigoPost;

    $sql = "SELECT id_usuario, codigo_recuperacao_hash, codigo_recuperacao_expira,
            (codigo_recuperacao_expira IS NOT NULL AND codigo_recuperacao_expira > NOW()) AS prazo_ok
            FROM usuario WHERE email = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("s", $email);
    if (!$stmt->execute()) {
        echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    if (!$row) {
        echo json_encode(["sucesso" => false, "erro" => "Codigo invalido"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $hash = $row["codigo_recuperacao_hash"] ?? "";
    $expira = $row["codigo_recuperacao_expira"] ?? "";
    if ($hash === "" || $expira === "") {
        echo json_encode(["sucesso" => false, "erro" => "Codigo invalido"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!password_verify($codigo, $hash)) {
        echo json_encode(["sucesso" => false, "erro" => "Codigo invalido"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ((int) ($row["prazo_ok"] ?? 0) !== 1) {
        echo json_encode(["sucesso" => false, "erro" => "Codigo expirado"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $resetToken = bin2hex(random_bytes(32));
    $resetExpira = date("Y-m-d H:i:s", time() + 1800);
    $sqlUp = "UPDATE usuario SET reset_token = ?, reset_token_expira = ?, codigo_recuperacao_hash = NULL, codigo_recuperacao_expira = NULL WHERE id_usuario = ?";
    $stmtUp = $conn->prepare($sqlUp);
    if (!$stmtUp) {
        echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $uid = (int) $row["id_usuario"];
    $stmtUp->bind_param("ssi", $resetToken, $resetExpira, $uid);
    if (!$stmtUp->execute()) {
        $err = $conn->error;
        if (stripos($err, "Unknown column") !== false) {
            echo json_encode(["sucesso" => false, "erro" => "Banco precisa das colunas de recuperacao"], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(["sucesso" => false, "erro" => "Erro no servidor"], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }
    echo json_encode([
        "sucesso" => true,
        "mensagem" => "OK",
        "reset_token" => $resetToken,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

error_reporting(E_ALL);
header("Content-Type: application/json; charset=utf-8");

function carregar_smtp_settings(string $baseDir): array
{
    $path = $baseDir . DIRECTORY_SEPARATOR . "smtp_settings.json";
    if (!is_readable($path)) {
        return ["erro" => "Falta smtp_settings.json. Copie smtp_settings.example.json para smtp_settings.json e edite."];
    }

    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === "") {
        return ["erro" => "smtp_settings.json esta vazio."];
    }

    if (strncmp($raw, "\xEF\xBB\xBF", 3) === 0) {
        $raw = substr($raw, 3);
    }

    $cfg = json_decode($raw, true);
    if (!is_array($cfg)) {
        $msg = json_last_error_msg();
        return ["erro" => "smtp_settings.json invalido: {$msg}. Copie de novo a partir de smtp_settings.example.json."];
    }

    return $cfg;
}

try {
    require_once dirname(__DIR__) . "/includes/conexao.php";

    $email = trim($_POST["email"] ?? "");
    if ($email === "") {
        echo json_encode(["erro" => "Informe o email"]);
        exit;
    }

    $cfg = carregar_smtp_settings(dirname(__DIR__) . "/config");
    if (isset($cfg["erro"])) {
        echo json_encode(["erro" => $cfg["erro"]]);
        exit;
    }

    $modoLocal = !empty($cfg["modo_local_sem_email"]);

    $respostaOk = [
        "sucesso" => true,
        "mensagem" => "Se este e-mail estiver cadastrado, siga para a verificação do código.",
    ];

    $sql = "SELECT id_usuario, nome, email FROM usuario WHERE email = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(["erro" => "Erro ao preparar consulta"]);
        exit;
    }

    $stmt->bind_param("s", $email);
    if (!$stmt->execute()) {
        echo json_encode(["erro" => "Erro ao consultar usuário"]);
        exit;
    }

    $user = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    if (!$user) {
        echo json_encode($respostaOk);
        exit;
    }

    $codigo = str_pad((string) random_int(0, 999999), 6, "0", STR_PAD_LEFT);
    $codigoHash = password_hash($codigo, PASSWORD_DEFAULT);

    $sqlUp = "UPDATE usuario
              SET codigo_recuperacao_hash = ?,
                  codigo_recuperacao_expira = DATE_ADD(NOW(), INTERVAL 15 MINUTE),
                  reset_token = NULL,
                  reset_token_expira = NULL
              WHERE id_usuario = ?";

    $stmtUp = $conn->prepare($sqlUp);
    if (!$stmtUp) {
        echo json_encode(["erro" => "Erro ao preparar atualização. Confira colunas codigo_recuperacao_* na tabela usuario."]);
        exit;
    }

    $stmtUp->bind_param("si", $codigoHash, $user["id_usuario"]);
    if (!$stmtUp->execute()) {
        $msg = $conn->error;
        if (stripos($msg, "Unknown column") !== false) {
            echo json_encode([
                "erro" => "Execute alter_recuperacao_usuario.sql no banco ecocoleta (colunas de recuperação).",
            ]);
        } else {
            echo json_encode(["erro" => "Erro ao salvar código: " . $msg]);
        }
        exit;
    }

    if ($modoLocal) {
        $respostaOk["mensagem"] = "Código gerado. No modo local ele será mostrado na tela (sem envio de e-mail).";
        $respostaOk["codigo_para_teste"] = $codigo;
        echo json_encode($respostaOk);
        exit;
    }

    foreach (["smtp_host", "smtp_port", "smtp_usuario", "smtp_senha", "smtp_de_email"] as $k) {
        if (!isset($cfg[$k]) || $cfg[$k] === "" || $cfg[$k] === null) {
            echo json_encode(["erro" => "Preencha \"$k\" em smtp_settings.json (veja COMO_CONFIGURAR_EMAIL.txt)."]);
            exit;
        }
    }

    $u = (string) $cfg["smtp_usuario"];
    $p = (string) $cfg["smtp_senha"];
    if (stripos($u, "COLOQUE") !== false || stripos($p, "COLOQUE") !== false
        || stripos($u, "SEU_EMAIL") !== false || stripos($p, "SUA_SENHA") !== false) {
        echo json_encode([
            "erro" => "Edite smtp_settings.json: coloque seu e-mail e senha de app reais (sem textos de exemplo).",
        ]);
        exit;
    }

    if (!is_file(dirname(__DIR__) . "/vendor/autoload.php")) {
        echo json_encode(["erro" => "Rode na pasta do projeto: composer require phpmailer/phpmailer"]);
        exit;
    }

    require_once dirname(__DIR__) . "/vendor/autoload.php";

    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host = (string) $cfg["smtp_host"];
        $mail->SMTPAuth = true;
        $mail->Username = (string) $cfg["smtp_usuario"];
        $mail->Password = (string) $cfg["smtp_senha"];
        $enc = strtolower((string) ($cfg["smtp_criptografia"] ?? "tls"));
        if ($enc === "ssl" || $enc === "smtps") {
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } else {
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        }
        $mail->Port = (int) $cfg["smtp_port"];
        $mail->CharSet = "UTF-8";
        $mail->Timeout = 45;

        if (!empty($cfg["smtp_relaxar_ssl"])) {
            $mail->SMTPOptions = [
                "ssl" => [
                    "verify_peer" => false,
                    "verify_peer_name" => false,
                    "allow_self_signed" => true,
                ],
            ];
        }

        $mail->setFrom((string) $cfg["smtp_de_email"], (string) ($cfg["smtp_de_nome"] ?? "EcoColeta"));
        $mail->addAddress($user["email"], $user["nome"]);

        $mail->isHTML(true);
        $mail->Subject = "EcoColeta — código de recuperação de senha";
        $nomeSafe = htmlspecialchars($user["nome"], ENT_QUOTES, "UTF-8");
        $codigoSafe = htmlspecialchars($codigo, ENT_QUOTES, "UTF-8");
        $mail->Body = "<p>Olá, <strong>{$nomeSafe}</strong>.</p>"
            . "<p>Seu código: <strong style=\"font-size:22px;letter-spacing:4px;\">{$codigoSafe}</strong></p>"
            . "<p>Válido por 15 minutos.</p>";
        $mail->AltBody = "Código EcoColeta: {$codigo} (15 minutos).";

        $mail->send();
    } catch (\PHPMailer\PHPMailer\Exception $e) {
        $msg = "Falha ao enviar o e-mail. Confira smtp_settings.json (host, porta, usuário, senha de app).";
        if (!empty($cfg["mostrar_erro_smtp"])) {
            $det = (isset($mail) && is_object($mail)) ? $mail->ErrorInfo : $e->getMessage();
            $msg .= " Detalhe técnico: " . $det;
        }
        echo json_encode(["erro" => $msg]);
        exit;
    }

    $respostaOk["mensagem"] = "Se este e-mail estiver cadastrado, enviamos um código para o e-mail informado. Verifique a caixa de entrada e o spam.";
    echo json_encode($respostaOk);
} catch (Throwable $e) {
    echo json_encode(["erro" => "Erro no servidor ao processar recuperação."]);
}
