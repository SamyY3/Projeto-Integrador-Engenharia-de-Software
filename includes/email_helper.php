<?php

if (!function_exists("ecocoleta_carregar_smtp_settings")) {
    function ecocoleta_carregar_smtp_settings(string $baseDir): array
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
}

if (!function_exists("ecocoleta_request_localhost")) {
    function ecocoleta_request_localhost(): bool
    {
        $host = strtolower((string) ($_SERVER["HTTP_HOST"] ?? $_SERVER["SERVER_NAME"] ?? ""));
        if ($host === "") {
            return false;
        }
        $host = preg_replace('/:\d+$/', "", $host);
        return in_array($host, ["localhost", "127.0.0.1", "::1"], true);
    }
}

if (!function_exists("ecocoleta_phpmailer_disponivel")) {
    function ecocoleta_phpmailer_disponivel(): bool
    {
        $autoload = dirname(__DIR__) . "/vendor/autoload.php";
        if (!is_file($autoload)) {
            return false;
        }
        require_once $autoload;

        return class_exists(\PHPMailer\PHPMailer\PHPMailer::class);
    }
}

if (!function_exists("ecocoleta_deve_usar_email_local")) {
    function ecocoleta_deve_usar_email_local(array $cfg): bool
    {
        if (!empty($cfg["modo_local_sem_email"])) {
            return true;
        }
        if (!ecocoleta_request_localhost()) {
            return false;
        }

        return !ecocoleta_phpmailer_disponivel();
    }
}

if (!function_exists("ecocoleta_enviar_codigo_por_email")) {

    function ecocoleta_enviar_codigo_por_email(
        array $cfg,
        string $emailDestino,
        string $nomeDestino,
        string $codigo,
        string $assunto,
        string $textoIntro
    ): array {
        foreach (["smtp_host", "smtp_port", "smtp_usuario", "smtp_senha", "smtp_de_email"] as $k) {
            if (!isset($cfg[$k]) || $cfg[$k] === "" || $cfg[$k] === null) {
                return [
                    "ok" => false,
                    "erro" => "Preencha \"$k\" em smtp_settings.json (veja COMO_CONFIGURAR_EMAIL.txt).",
                ];
            }
        }

        $u = (string) $cfg["smtp_usuario"];
        $p = (string) $cfg["smtp_senha"];
        if (stripos($u, "COLOQUE") !== false || stripos($p, "COLOQUE") !== false
            || stripos($u, "SEU_EMAIL") !== false || stripos($p, "SUA_SENHA") !== false) {
            return [
                "ok" => false,
                "erro" => "Edite smtp_settings.json: coloque seu e-mail e senha de app reais (sem textos de exemplo).",
            ];
        }

        if (!ecocoleta_phpmailer_disponivel()) {
            return [
                "ok" => false,
                "erro" => "PHPMailer nao instalado. Na pasta do projeto rode: composer install "
                    . "(no XAMPP, ative extension=zip em php.ini e reinicie o Apache).",
            ];
        }

        try {
            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        } catch (Throwable $e) {
            return [
                "ok" => false,
                "erro" => "Nao foi possivel carregar PHPMailer. Rode composer install na pasta do projeto.",
            ];
        }

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

            $mail->setFrom(
                (string) $cfg["smtp_de_email"],
                (string) ($cfg["smtp_de_nome"] ?? "EcoColeta")
            );
            $mail->addAddress($emailDestino, $nomeDestino);

            $mail->isHTML(true);
            $mail->Subject = $assunto;

            $nomeSafe = htmlspecialchars($nomeDestino, ENT_QUOTES, "UTF-8");
            $codigoSafe = htmlspecialchars($codigo, ENT_QUOTES, "UTF-8");
            $introSafe = $textoIntro;

            $mail->Body = "<p>Ola, <strong>{$nomeSafe}</strong>.</p>"
                . "<p>{$introSafe}</p>"
                . "<p>Seu codigo: <strong style=\"font-size:22px;letter-spacing:4px;\">{$codigoSafe}</strong></p>"
                . "<p>Valido por 15 minutos.</p>"
                . "<p style=\"color:#64748b;font-size:12px;\">Se voce nao solicitou, ignore este e-mail.</p>";

            $mail->AltBody = strip_tags(str_replace(["<br>", "</p>"], "\n", $textoIntro))
                . "\nCodigo EcoColeta: {$codigo} (15 minutos).";

            $mail->send();
            return ["ok" => true];
        } catch (\PHPMailer\PHPMailer\Exception $e) {
            $msg = "Falha ao enviar o e-mail. Confira smtp_settings.json (host, porta, usuario, senha de app).";
            if (!empty($cfg["mostrar_erro_smtp"])) {
                $det = (isset($mail) && is_object($mail)) ? $mail->ErrorInfo : $e->getMessage();
                $msg .= " Detalhe tecnico: " . $det;
            }
            return ["ok" => false, "erro" => $msg];
        } catch (Throwable $e) {
            return [
                "ok" => false,
                "erro" => "Erro inesperado ao enviar e-mail. Confira composer install e smtp_settings.json.",
            ];
        }
    }
}
