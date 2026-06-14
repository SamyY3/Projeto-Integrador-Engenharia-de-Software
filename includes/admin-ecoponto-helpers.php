<?php

require_once __DIR__ . "/stmt_helpers.php";

function ecoadm_json_erro(string $msg, int $code = 200): void
{
    http_response_code($code);
    echo json_encode(["sucesso" => false, "erro" => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function ecoadm_json_ok(array $payload = []): void
{
    echo json_encode(array_merge(["sucesso" => true], $payload), JSON_UNESCAPED_UNICODE);
    exit;
}

function ecoadm_bairro_rotulo_exibicao(string $nome): string
{
    $nome = trim($nome);
    if ($nome === "") {
        return "";
    }
    if (preg_match('/^(.+?)\s*\([^)]*\)\s*$/u', $nome, $m)) {
        return trim($m[1]);
    }
    return $nome;
}

function ecoadm_exigir_sessao(): int
{
    if (empty($_SESSION["ecoponto_admin_id"]) || (int) $_SESSION["ecoponto_admin_id"] <= 0) {
        ecoadm_json_erro("Sessao administrativa expirada. Faca login novamente.");
    }
    return (int) $_SESSION["ecoponto_admin_id"];
}

function ecoadm_admin_tem_coluna(mysqli $conn, string $nome): bool
{
    if (!isset($GLOBALS["ecoadm_admin_cols_cache"]) || !is_array($GLOBALS["ecoadm_admin_cols_cache"])) {
        $GLOBALS["ecoadm_admin_cols_cache"] = [];
        $q = @$conn->query("SHOW COLUMNS FROM administrador_ecoponto");
        if ($q) {
            while ($row = $q->fetch_assoc()) {
                $GLOBALS["ecoadm_admin_cols_cache"][$row["Field"]] = true;
            }
            $q->free();
        }
    }
    return !empty($GLOBALS["ecoadm_admin_cols_cache"][$nome]);
}

function ecoadm_invalidar_cache_admin(): void
{
    $GLOBALS["ecoadm_admin_cols_cache"] = null;
}

function ecoadm_garantir_colunas_admin(mysqli $conn): void
{
    if (!ecoadm_admin_tem_coluna($conn, "foto_perfil")) {
        @$conn->query(
            "ALTER TABLE administrador_ecoponto
             ADD COLUMN foto_perfil VARCHAR(255) NULL DEFAULT NULL AFTER nome_ecoponto"
        );
    }
    if (!ecoadm_admin_tem_coluna($conn, "preferencias_json")) {
        @$conn->query(
            "ALTER TABLE administrador_ecoponto
             ADD COLUMN preferencias_json MEDIUMTEXT NULL DEFAULT NULL AFTER foto_perfil"
        );
    }
    if (!ecoadm_admin_tem_coluna($conn, "funcao")) {
        @$conn->query(
            "ALTER TABLE administrador_ecoponto
             ADD COLUMN funcao ENUM('titular','gestor','operador') NOT NULL DEFAULT 'titular' AFTER nome_ecoponto"
        );
    }
    if (!ecoadm_admin_tem_coluna($conn, "telefone")) {
        @$conn->query(
            "ALTER TABLE administrador_ecoponto
             ADD COLUMN telefone VARCHAR(20) NULL DEFAULT NULL AFTER email"
        );
    }
    ecoadm_invalidar_cache_admin();
    ecoadm_migrar_uploads_legado();
    ecoadm_invalidar_cache_admin();
}

function ecoadm_migrar_uploads_legado(): void
{
    $legado = __DIR__ . DIRECTORY_SEPARATOR . "uploads";
    $destino = dirname(__DIR__) . DIRECTORY_SEPARATOR . "uploads";
    if (!is_dir($legado) || !is_dir($destino)) {
        return;
    }
    foreach (glob($legado . DIRECTORY_SEPARATOR . "adm_*") ?: [] as $arquivo) {
        if (!is_file($arquivo)) {
            continue;
        }
        $alvo = $destino . DIRECTORY_SEPARATOR . basename($arquivo);
        if (!is_file($alvo)) {
            @copy($arquivo, $alvo);
        }
    }
}

function ecoadm_normalizar_telefone(string $tel): string
{
    return preg_replace("/\D/", "", trim($tel));
}

function ecoadm_telefone_demo(int $idAdmin): string
{
    return sprintf("889%07d", 9000000 + ($idAdmin % 10000000));
}

function ecoadm_garantir_telefone_admin(mysqli $conn, int $idAdmin): string
{
    ecoadm_garantir_colunas_admin($conn);
    if (!ecoadm_admin_tem_coluna($conn, "telefone") || $idAdmin <= 0) {
        return "";
    }

    $stmt = $conn->prepare("SELECT telefone FROM administrador_ecoponto WHERE id_admin = ? LIMIT 1");
    if (!$stmt) {
        return "";
    }
    $stmt->bind_param("i", $idAdmin);
    if (!$stmt->execute()) {
        $stmt->close();
        return "";
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();

    $atual = ecoadm_normalizar_telefone((string) ($row["telefone"] ?? ""));
    if (strlen($atual) >= 10) {
        return $atual;
    }

    $novo = ecoadm_telefone_demo($idAdmin);
    $stmtUp = $conn->prepare(
        "UPDATE administrador_ecoponto SET telefone = ? WHERE id_admin = ? LIMIT 1"
    );
    if ($stmtUp) {
        $stmtUp->bind_param("si", $novo, $idAdmin);
        $stmtUp->execute();
        $stmtUp->close();
    }

    return $novo;
}

function ecoadm_mascarar_email(string $email): string
{
    $email = trim($email);
    if ($email === "" || strpos($email, "@") === false) {
        return "***";
    }
    [$user, $domain] = explode("@", $email, 2);
    $first = function_exists("mb_substr") ? mb_substr($user, 0, 1, "UTF-8") : substr($user, 0, 1);
    if ($first === "") {
        $first = "*";
    }

    return $first . "***@" . $domain;
}

function ecoadm_mascarar_telefone(string $tel): string
{
    $digits = ecoadm_normalizar_telefone($tel);
    if (strlen($digits) < 4) {
        return "(**) *****-****";
    }
    $last4 = substr($digits, -4);
    if (strlen($digits) >= 11) {
        return "(" . substr($digits, 0, 2) . ") *****-" . $last4;
    }

    return "*****-" . $last4;
}

function ecoadm_limpar_verificacao_email_sessao(): void
{
    unset(
        $_SESSION["ecoponto_admin_email_alt_novo"],
        $_SESSION["ecoponto_admin_email_alt_hash"],
        $_SESSION["ecoponto_admin_email_alt_expira"],
        $_SESSION["ecoponto_admin_email_alt_canal"],
        $_SESSION["ecoponto_admin_email_alt_verificado"],
        $_SESSION["ecoponto_admin_email_alt_tentativas"]
    );
}

function ecoadm_email_alteracao_verificada(string $novoEmail): bool
{
    if (empty($_SESSION["ecoponto_admin_email_alt_verificado"])) {
        return false;
    }
    $pendente = trim((string) ($_SESSION["ecoponto_admin_email_alt_novo"] ?? ""));

    return $pendente !== "" && strcasecmp($pendente, trim($novoEmail)) === 0;
}

function ecoadm_enviar_codigo_alteracao_email(
    string $emailDestino,
    string $nomeDestino,
    string $codigo,
    string $novoEmail
): array {
    require_once __DIR__ . "/email_helper.php";

    $cfg = ecocoleta_carregar_smtp_settings(dirname(__DIR__) . "/config");
    if (isset($cfg["erro"])) {
        return ["ok" => false, "erro" => $cfg["erro"]];
    }

    if (ecocoleta_deve_usar_email_local($cfg)) {
        return ["ok" => true, "modo_local" => true, "codigo_para_teste" => $codigo];
    }

    $intro = "Voce solicitou alterar o e-mail da sua conta administrativa para "
        . $novoEmail
        . ". Use o codigo abaixo para confirmar a troca:";

    return ecocoleta_enviar_codigo_por_email(
        $cfg,
        $emailDestino,
        $nomeDestino,
        $codigo,
        "EcoColeta - confirmar alteracao de e-mail",
        $intro
    );
}

function ecoadm_enviar_codigo_alteracao_telefone(string $telefone, string $codigo): array
{
    require_once __DIR__ . "/email_helper.php";

    $cfg = ecocoleta_carregar_smtp_settings(dirname(__DIR__) . "/config");
    if (!isset($cfg["erro"]) && ecocoleta_deve_usar_email_local($cfg)) {
        return ["ok" => true, "modo_local" => true, "codigo_para_teste" => $codigo];
    }
    if (ecocoleta_request_localhost()) {
        return ["ok" => true, "modo_local" => true, "codigo_para_teste" => $codigo];
    }

    return [
        "ok" => false,
        "erro" => "Envio de SMS nao configurado. Use o e-mail atual ou teste em localhost.",
    ];
}

function ecoadm_funcao_label(string $funcao): string
{
    $map = [
        "titular" => "Administrador titular",
        "gestor" => "Gestor do EcoPonto",
        "operador" => "Operador",
    ];
    return $map[$funcao] ?? "Administrador";
}

function ecoadm_normalizar_funcao(?string $funcao): string
{
    $f = strtolower(trim((string) $funcao));
    if (in_array($f, ["titular", "gestor", "operador"], true)) {
        return $f;
    }
    return "gestor";
}

function ecoadm_preferencias_padrao(): array
{
    return [
        "idioma" => "pt-BR",
        "notificacoes" => true,
        "tema" => "dark",
        "horarios" => "08:00-17:00",
        "tipo_coleta" => "truck",
        "dois_fatores" => true,
        "areas_atendidas" => ["Centro", "Zona Norte", "Zona Sul"],
    ];
}

function ecoadm_normalizar_preferencias($raw): array
{
    $padrao = ecoadm_preferencias_padrao();
    if (!is_array($raw)) {
        return $padrao;
    }

    $out = $padrao;
    if (isset($raw["idioma"]) && is_string($raw["idioma"]) && $raw["idioma"] !== "") {
        $out["idioma"] = $raw["idioma"];
    }
    if (array_key_exists("notificacoes", $raw)) {
        $out["notificacoes"] = (bool) $raw["notificacoes"];
    }
    if (isset($raw["tema"]) && in_array($raw["tema"], ["light", "dark"], true)) {
        $out["tema"] = $raw["tema"];
    }
    if (isset($raw["horarios"]) && is_string($raw["horarios"]) && $raw["horarios"] !== "") {
        $out["horarios"] = $raw["horarios"];
    }
    if (isset($raw["tipo_coleta"])) {
        $tipo = (string) $raw["tipo_coleta"];
        if ($tipo === "manual") {
            $tipo = "prefeitura";
        }
        if (in_array($tipo, ["truck", "prefeitura"], true)) {
            $out["tipo_coleta"] = $tipo;
        }
    }
    if (array_key_exists("dois_fatores", $raw)) {
        $out["dois_fatores"] = (bool) $raw["dois_fatores"];
    }
    if (isset($raw["areas_atendidas"]) && is_array($raw["areas_atendidas"])) {
        $areas = [];
        foreach ($raw["areas_atendidas"] as $a) {
            $t = trim((string) $a);
            if ($t !== "") {
                $areas[] = $t;
            }
        }
        if (!empty($areas)) {
            $out["areas_atendidas"] = array_values($areas);
        }
    }

    return $out;
}

function ecoadm_sync_sessao_admin(array $row): void
{
    $_SESSION["ecoponto_admin_nome"] = (string) ($row["nome"] ?? "Administrador");
    $_SESSION["ecoponto_admin_email"] = (string) ($row["email"] ?? "");
    $_SESSION["ecoponto_admin_nome_ecoponto"] = (string) ($row["nome_ecoponto"] ?? "EcoPonto parceiro");
    if (array_key_exists("foto_perfil", $row) && $row["foto_perfil"] !== null && $row["foto_perfil"] !== "") {
        $_SESSION["ecoponto_admin_foto"] = (string) $row["foto_perfil"];
    }
}

function ecoadm_diretorio_uploads(): string|false
{
    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . "uploads";
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0777, true) && !is_dir($dir)) {
            return false;
        }
    }
    return is_writable($dir) ? $dir : false;
}

function ecoadm_cliente_enviou_foto(): bool
{
    if (!empty($_POST["foto_base64"]) && is_string($_POST["foto_base64"])) {
        return true;
    }
    if (!empty($_FILES["foto"]["name"])) {
        return true;
    }

    return false;
}

function ecoadm_arquivo_imagem_valido(string $tmp, string $nomeArquivo, string $mime): bool
{
    if ($mime !== "" && strpos($mime, "image/") === 0) {
        return true;
    }
    if ($tmp !== "" && function_exists("mime_content_type")) {
        $detectado = (string) mime_content_type($tmp);
        if ($detectado !== "" && strpos($detectado, "image/") === 0) {
            return true;
        }
    }

    return (bool) preg_match("/\.(png|jpe?g|webp|gif)$/i", $nomeArquivo);
}

function ecoadm_processar_foto_upload(int $idAdmin): string|null
{
    $fotoFile = (isset($_FILES["foto"]) && is_array($_FILES["foto"])) ? $_FILES["foto"] : null;
    $querBase64 = !empty($_POST["foto_base64"]) && is_string($_POST["foto_base64"]);
    $querFile = $fotoFile && !empty($fotoFile["tmp_name"]) && is_uploaded_file((string) $fotoFile["tmp_name"]);

    if (!$querFile && !$querBase64) {
        return null;
    }

    $dir = ecoadm_diretorio_uploads();
    if ($dir === false) {
        ecoadm_json_erro("Pasta uploads indisponivel. Crie Ecocoleta/uploads com permissao de escrita.");
    }

    $rel = "uploads/";

    if ($querFile) {
        $uploadErr = (int) ($fotoFile["error"] ?? UPLOAD_ERR_OK);
        if ($uploadErr !== UPLOAD_ERR_OK) {
            if (!$querBase64) {
                ecoadm_json_erro("Erro no upload da foto (codigo " . $uploadErr . "). Tente outra imagem ou reduza o tamanho.");
            }
        } else {
            $tmp = (string) $fotoFile["tmp_name"];
            $mime = (string) ($fotoFile["type"] ?? "");
            $orig = isset($fotoFile["name"]) ? basename((string) $fotoFile["name"]) : "foto";
            if (!ecoadm_arquivo_imagem_valido($tmp, $orig, $mime)) {
                ecoadm_json_erro("Arquivo de foto invalido. Use PNG, JPG ou WebP.");
            }
            $orig = preg_replace("/[^a-zA-Z0-9._-]/", "_", $orig);
            if ($orig === "" || $orig === "_") {
                $orig = "foto.jpg";
            }
            $nomeArq = "adm_" . time() . "_" . $idAdmin . "_" . $orig;
            $destinoFs = $dir . DIRECTORY_SEPARATOR . $nomeArq;
            if (@move_uploaded_file($tmp, $destinoFs) || @copy($tmp, $destinoFs)) {
                return $rel . $nomeArq;
            }
        }
    }

    if ($querBase64) {
        $raw = (string) $_POST["foto_base64"];
        if (preg_match("#^data:image/(png|jpeg|jpg|webp|gif);base64,#i", $raw, $m)) {
            $ext = strtolower($m[1]);
            if ($ext === "jpeg") {
                $ext = "jpg";
            }
            $data = preg_replace("#^data:image/[^;]+;base64,#", "", $raw);
            $bin = base64_decode($data, true);
            if ($bin !== false && strlen($bin) > 0 && strlen($bin) < 6 * 1024 * 1024) {
                $nomeArq = "adm_" . time() . "_" . $idAdmin . "_preview." . $ext;
                $destinoFs = $dir . DIRECTORY_SEPARATOR . $nomeArq;
                if (@file_put_contents($destinoFs, $bin) !== false) {
                    return $rel . $nomeArq;
                }
            }
        }
    }

    ecoadm_json_erro("Nao foi possivel salvar a foto. Use PNG, JPG ou WebP.");
}

function ecoadm_validar_email_senha(): array
{
    $email = trim((string) ($_POST["email"] ?? ""));
    $confirmEmail = trim((string) ($_POST["confirmaremail"] ?? ""));
    $senha = (string) ($_POST["senha"] ?? "");
    $confirmSenha = (string) ($_POST["confirmarsenha"] ?? "");

    if ($email === "" || $confirmEmail === "") {
        ecoadm_json_erro("Preencha o e-mail e a confirmacao.");
    }
    if ($email !== $confirmEmail) {
        ecoadm_json_erro("Os e-mails nao coincidem.");
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        ecoadm_json_erro("E-mail invalido.");
    }
    if ($senha !== $confirmSenha) {
        ecoadm_json_erro("As senhas nao coincidem.");
    }
    if ($senha !== "" && strlen($senha) < 8) {
        ecoadm_json_erro("Senha deve ter pelo menos 8 caracteres.");
    }
    if ($senha !== "" && !preg_match("/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/", $senha)) {
        ecoadm_json_erro("Senha deve conter maiuscula, minuscula e numero.");
    }

    return [$email, $senha];
}

function ecoadm_exigir_verificacao_troca_email(mysqli $conn, int $idAdmin, string $emailAtual, string $emailNovo): void
{
    $emailAtual = trim($emailAtual);
    $emailNovo = trim($emailNovo);
    if ($emailNovo === "" || strcasecmp($emailAtual, $emailNovo) === 0) {
        return;
    }

    if (!ecoadm_email_alteracao_verificada($emailNovo)) {
        ecoadm_json_erro(
            "Para alterar o e-mail, confirme o codigo enviado ao e-mail ou telefone atual."
        );
    }

    $stmt = $conn->prepare(
        "SELECT id_admin FROM administrador_ecoponto WHERE email = ? AND id_admin <> ? LIMIT 1"
    );
    if ($stmt) {
        $stmt->bind_param("si", $emailNovo, $idAdmin);
        if ($stmt->execute()) {
            $row = ecocoleta_stmt_fetch_one_assoc($stmt);
            if ($row) {
                $stmt->close();
                ecoadm_json_erro("Este e-mail ja esta em uso por outro administrador.");
            }
        }
        $stmt->close();
    }
}
