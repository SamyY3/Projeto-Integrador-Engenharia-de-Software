<?php

mysqli_report(MYSQLI_REPORT_OFF);

$GLOBALS["ecocoleta_sql_dir"] = dirname(__DIR__) . DIRECTORY_SEPARATOR . "database";

if (!function_exists("ecocoleta_falhar_conexao")) {
    function ecocoleta_falhar_conexao(string $msg, ?string $detalhe = null): void
    {
        if (!headers_sent()) {
            header("Content-Type: application/json; charset=utf-8", true, 503);
        }
        echo json_encode(
            ["erro" => $msg, "detalhe" => $detalhe],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }
}

if (!function_exists("ecocoleta_tentar_conectar")) {
    function ecocoleta_tentar_conectar(string $host, string $user, string $pass, ?string $db = null): mysqli
    {
        return @new mysqli($host, $user, $pass, $db ?? "");
    }
}

if (!function_exists("ecocoleta_config_valor")) {
    function ecocoleta_config_valor(array $config, array $envKeys, string $configKey, string $default): string
    {
        foreach ($envKeys as $key) {
            $value = getenv($key);
            if ($value !== false && trim((string) $value) !== "") {
                return trim((string) $value);
            }
        }
        if (isset($config[$configKey]) && trim((string) $config[$configKey]) !== "") {
            return trim((string) $config[$configKey]);
        }
        return $default;
    }
}

if (!function_exists("ecocoleta_rodar_sql_seguro")) {

    function ecocoleta_rodar_sql_seguro(mysqli $conn, string $caminho): void
    {
        if (!is_file($caminho)) {
            return;
        }
        $sql = file_get_contents($caminho);
        if ($sql === false || $sql === "") {
            return;
        }
        $sql = preg_replace('/^\s*--[^\n]*\n?/m', "", $sql);
        $instrucoes = preg_split('/;\s*(?:\r?\n|$)/', (string) $sql);
        if (!is_array($instrucoes)) {
            return;
        }
        foreach ($instrucoes as $instr) {
            $instr = trim($instr, " \t\r\n;");
            if ($instr === "") {
                continue;
            }
            @$conn->query($instr);
        }
    }
}

if (!function_exists("ecocoleta_criar_banco_e_importar")) {

    function ecocoleta_criar_banco_e_importar(mysqli $conn, string $banco, string $baseDir): bool
    {
        $bancoEscapado = str_replace("`", "``", $banco);
        @$conn->query("CREATE DATABASE IF NOT EXISTS `{$bancoEscapado}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        if (!@$conn->select_db($banco)) {
            return false;
        }
        $arquivos = [
            "SQL_BDD_EcoColeta.sql",
            "usuario_edicao_opcional.sql",
            "corrigir_tipo_expiracao_codigo.sql",
            "premios_beneficios_resgate.sql",
            "agendamento_coleta_tab.sql",
            "cadastro_pendente_tab.sql",
            "notificacao_tab.sql",
            "notificacao_admin_tab.sql",
            "admin_ecoponto_integracao.sql",
            "admin_plataforma_integracao.sql",
        ];
        foreach ($arquivos as $f) {
            ecocoleta_rodar_sql_seguro($conn, $baseDir . DIRECTORY_SEPARATOR . $f);
        }
        return (bool) @$conn->select_db($banco);
    }
}

$configExterna = [];
$configPath = __DIR__ . "/conexao.config.php";
if (is_file($configPath)) {
    $loadedConfig = require $configPath;
    if (is_array($loadedConfig)) {
        $configExterna = $loadedConfig;
    }
}

$host = ecocoleta_config_valor($configExterna, ["ECO_DB_HOST", "DB_HOST", "MYSQL_HOST"], "host", "localhost");
$usuario = ecocoleta_config_valor($configExterna, ["ECO_DB_USER", "DB_USER", "MYSQL_USER"], "usuario", "root");
$senha = ecocoleta_config_valor($configExterna, ["ECO_DB_PASS", "DB_PASS", "MYSQL_PASSWORD"], "senha", "");
$banco = ecocoleta_config_valor($configExterna, ["ECO_DB_NAME", "DB_NAME", "MYSQL_DATABASE"], "banco", "ecocoleta");

$autoInstallEnv = getenv("ECO_DB_AUTO_INSTALL");
$autoInstall = isset($configExterna["auto_install"]) ? (bool) $configExterna["auto_install"] : true;
if ($autoInstallEnv !== false && trim((string) $autoInstallEnv) !== "") {
    $autoInstall = !in_array(strtolower(trim((string) $autoInstallEnv)), ["0", "false", "no", "off"], true);
}

$conn = ecocoleta_tentar_conectar($host, $usuario, $senha, $banco);

if ($conn->connect_errno === 1049 && $autoInstall) {
    $boot = ecocoleta_tentar_conectar($host, $usuario, $senha);
    if ($boot->connect_errno) {
        ecocoleta_falhar_conexao(
            "Conectei ao servidor mas perdi a conexao ao tentar criar o banco '{$banco}'. Verifique as credenciais e permissoes do usuario MySQL.",
            $boot->connect_error
        );
    }
    if (!ecocoleta_criar_banco_e_importar($boot, $banco, $GLOBALS["ecocoleta_sql_dir"])) {
        ecocoleta_falhar_conexao(
            "O banco '{$banco}' nao existe e nao consegui criar automaticamente. Em hospedagem, crie o banco no cPanel e importe os arquivos SQL do projeto.",
            $boot->error ?: null
        );
    }
    @$boot->close();
    $conn = ecocoleta_tentar_conectar($host, $usuario, $senha, $banco);
}

if ($conn->connect_errno && $host === "localhost") {
    $conn2 = ecocoleta_tentar_conectar("127.0.0.1", $usuario, $senha, $banco);
    if ($conn2->connect_errno === 1049 && $autoInstall) {
        $boot = ecocoleta_tentar_conectar("127.0.0.1", $usuario, $senha);
        if (!$boot->connect_errno) {
            ecocoleta_criar_banco_e_importar($boot, $banco, $GLOBALS["ecocoleta_sql_dir"]);
            @$boot->close();
            $conn2 = ecocoleta_tentar_conectar("127.0.0.1", $usuario, $senha, $banco);
        }
    }
    if (!$conn2->connect_errno) {
        $conn = $conn2;
        $host = "127.0.0.1";
    }
}

if ($conn->connect_errno) {
    $cod = (int) $conn->connect_errno;
    $det = $conn->connect_error;

    if ($cod === 1045) {
        ecocoleta_falhar_conexao(
            "Usuario '{$usuario}' ou senha do MySQL nao confere. Em hospedagem, ajuste ECO_DB_USER/ECO_DB_PASS ou conexao.config.php.",
            $det
        );
    }
    if ($cod === 2002 || $cod === 2003 || $cod === 2005) {
        ecocoleta_falhar_conexao(
            "Nao consegui falar com o MySQL. Abra o XAMPP Control Panel e clique Start no MySQL. Se ele recusar, veja o log em xampp\\mysql\\data\\mysql_error.log.",
            $det
        );
    }
    if ($cod === 1049) {
        ecocoleta_falhar_conexao(
            "O banco '{$banco}' nao existe. Crie o banco na hospedagem/cPanel e importe os arquivos SQL do projeto.",
            $det
        );
    }
    ecocoleta_falhar_conexao(
        "Erro inesperado ao conectar ao banco. Codigo: {$cod}.",
        $det
    );
}

$conn->set_charset("utf8mb4");

if (!function_exists("ecocoleta_tabela_existe")) {
    function ecocoleta_tabela_existe(mysqli $conn, string $tabela): bool
    {
        $tabela = preg_replace('/[^A-Za-z0-9_]/', "", $tabela);
        $res = @$conn->query("SHOW TABLES LIKE '{$tabela}'");
        if (!$res) {
            return false;
        }
        $existe = ($res->num_rows > 0);
        $res->free();
        return $existe;
    }
}

$tabelasObrigatorias = [
    "cadastro_pendente",
    "agendamento_coleta_morador",
    "notificacao",
];
$precisaMigrar = false;
foreach ($tabelasObrigatorias as $t) {
    if (!ecocoleta_tabela_existe($conn, $t)) {
        $precisaMigrar = true;
        break;
    }
}
if ($precisaMigrar && $autoInstall) {
    ecocoleta_criar_banco_e_importar($conn, $banco, $GLOBALS["ecocoleta_sql_dir"]);
}

if ($autoInstall && is_file(__DIR__ . "/eco-seed-bootstrap.php")) {
    require_once __DIR__ . "/eco-seed-bootstrap.php";
    ecoseed_bootstrap_if_needed($conn);
}

$conexao = $conn;

require_once __DIR__ . "/stmt_helpers.php";
