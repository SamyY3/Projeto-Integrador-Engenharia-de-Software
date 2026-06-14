<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$isCli = PHP_SAPI === 'cli';
if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!in_array($remote, ['127.0.0.1', '::1'], true)) {
        http_response_code(403);
        exit("Acesso apenas em localhost.\n");
    }
}

$log = [];

function ensure_dir(string $path): void
{
    if (!is_dir($path)) {
        mkdir($path, 0755, true);
    }
}

function resolve_root_file(string $root, string $name, string $destDir, array &$log): void
{
    $src = $root . DIRECTORY_SEPARATOR . $name;
    if (!is_file($src)) {
        return;
    }
    $destFolder = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $destDir);
    ensure_dir($destFolder);
    $dest = $destFolder . DIRECTORY_SEPARATOR . $name;
    if (is_file($dest)) {
        unlink($src);
        $log[] = "Dup removido: $name";
    } else {
        rename($src, $dest);
        $log[] = "Movido: $name -> $destDir/";
    }
}

$map = [
    'database' => [
        'SQL_BDD_EcoColeta.sql', 'usuario_edicao_opcional.sql', 'corrigir_tipo_expiracao_codigo.sql',
        'premios_beneficios_resgate.sql', 'agendamento_coleta_tab.sql', 'cadastro_pendente_tab.sql',
        'notificacao_tab.sql', 'alter_recuperacao_usuario.sql',
    ],
    'includes' => [
        'conexao.php', 'conexao.config.example.php', 'email_helper.php', 'senha-validacao.php',
        'stmt_helpers.php', 'notificacoes_helper.php', 'admin-plataforma-helpers.php',
        'admin-ecoponto-helpers.php', 'admin-plataforma-session.php', 'admin-ecoponto-session.php',
        'edicaoperfil_body.inc.php',
    ],
    'config' => [
        'apache-ecocoleta-php.conf', 'smtp_settings.json', 'smtp_settings.example.json',
        'DEPLOY.md', 'COMO_RODAR.txt', 'COMO_RODAR_O_PROJETO.txt', 'LEIA-ME_PHP.txt',
        'COMO_CONFIGURAR_EMAIL.txt', 'INSTALAR-BANCO.bat', 'INICIAR-PROJETO.bat',
    ],
    'auth' => [
        'login.html', 'login.php', 'cadastro.html', 'cadastro.php', 'recuperar.html', 'recuperar.php',
        'nova-senha.html', 'resetar.html', 'resetar_senha.php', 'verificacao.html',
        'verificar-cadastro.html', 'verificar_cadastro.php', 'senha-criada.html',
        'verificar_codigo_recuperacao.php', 'vc.php', 'login-temp.html',
    ],
    'admin' => [
        'Login-ADM.html', 'Login-ADM.php', 'Login-ADM.css', 'Login-ADM-Ecoponto.html',
        'Login-ADM-Ecoponto.php', 'Login-ADM-Ecoponto.css', 'Home-ADM.html', 'home-adm.css',
        'home-adm.js', 'Home-ADM-Ecoponto.html', 'home-adm-ecoponto.css', 'home-adm-ecoponto.js',
        'edicao-perfil-admin.html', 'edicao-perfil-admin.css', 'edicao-perfil-admin.js',
        'configuracoes-ADM-Ecoponto.html', 'configuracoes-adm-ecoponto.css', 'configuracoes-adm-ecoponto.js',
        'configuracoes-adm.html', 'relatorio-ADM-Ecoponto.html', 'relatorio-adm-ecoponto.css',
        'relatorio-adm-ecoponto.js', 'relatorio-adm.html', 'relatorio-adm.css', 'relatorio-adm.js',
        'materias-ADM-Ecoponto.html', 'materias-adm-ecoponto.css', 'materias-adm-ecoponto.js',
        'coletas-ADM-Ecoponto.html', 'Coletas-ADM-Ecoponto.html', 'coletas-adm-ecoponto.css',
        'coletas-adm-ecoponto.js', 'agendamento-adm.html', 'ecoponto-adm.html', 'usuarios-adm.html',
        'mapa-publico-adm.html', 'adm-sidebar-icons.js', 'adm-sidebar-icons.svg', 'login-adm-pontos.php',
    ],
    'api' => [
        'ecocheck-api.php', 'agendamento_coleta.php', 'agendamento_coleta_api.php', 'geocode-nominatim.php',
        'notificacoes.php', 'logout.php', 'meu_perfil.php', 'resgate_premio.php', 'registrar_entrega.php',
        'excluir_conta.php', 'atualizar-nome.php', 'atualizar-perfil.php', 'atualizar-perfil-admin.php',
        'atualizarperfil.php', 'atualizar_nome.php', 'configuracoes-adm-ecoponto.php', 'meu-perfil-admin.php',
        'edicaoperfil.php',
    ],
    'pages' => [
        'tela-inicia.html', 'ecopontos.html', 'perfil.html', 'educacao-ambiental.html', 'agendar-coleta.html',
        'pagina-relatorio.html', 'relatorio.html', 'Ranking.html', 'quem-somos.html', 'edicaoperfil.html',
        'como-funciona.html', 'premios-disponiveis.html', 'formulario-coleta.html', 'relatorio-mensal.html',
        'notif-popup.html', 'mapa.html', 'balanca-ecoponto.html', 'apoiador.html',
    ],
    'mapa' => ['mapa.js', 'mapa.css'],
    'assets/css' => [
        'style.css', 'home.css', 'header.css', 'footer.css', 'premios.css', 'ranking.css', 'perfil.css',
        'perfil-avatar.css', 'user-popup.css', 'notif-popup.css', 'agendar-coleta.css', 'pagina-relatorio.css',
        'relatorio-mensal.css', 'educacao-ambiental.css', 'ecopontos.css', 'quem-somos.css', 'como-funciona.css',
        'edicaoperfil.css', 'ecocheck-widget.css', 'anti-bot.css',
    ],
    'assets/js' => [
        'home.js', 'header-nav.js', 'header-scroll.js', 'footer.js', 'premios.js', 'ranking.js', 'perfil.js',
        'perfil-avatar.js', 'user-popup.js', 'notif-popup.js', 'agendar-coleta.js', 'edicaoperfil.js',
        'ecopontos.js', 'password-toggle.js', 'ecocheck-bridge.js', 'anti-bot.js', 'validate_html.js',
        'transport-times-widget.js',
    ],
];

foreach ($map as $dir => $files) {
    ensure_dir($root . DIRECTORY_SEPARATOR . $dir);
    foreach ($files as $file) {
        resolve_root_file($root, $file, $dir, $log);
    }
}

$imagens = $root . DIRECTORY_SEPARATOR . 'Imagens';
if (is_dir($imagens)) {
    $target = $root . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'images';
    ensure_dir($target);
    foreach (scandir($imagens) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $from = $imagens . DIRECTORY_SEPARATOR . $entry;
        $to = $target . DIRECTORY_SEPARATOR . $entry;
        if (is_file($to)) {
            unlink($from);
        } else {
            rename($from, $to);
        }
    }
    @rmdir($imagens);
    $log[] = 'Imagens/ -> assets/images/';
}

$includesFiles = [
    'conexao.php', 'email_helper.php', 'senha-validacao.php', 'stmt_helpers.php',
    'notificacoes_helper.php', 'admin-plataforma-helpers.php', 'admin-ecoponto-helpers.php',
    'admin-plataforma-session.php', 'admin-ecoponto-session.php', 'edicaoperfil_body.inc.php',
];
$scanDirs = ['api', 'auth', 'admin', 'includes'];
$phpFixed = 0;
foreach ($scanDirs as $dir) {
    $base = $root . DIRECTORY_SEPARATOR . $dir;
    if (!is_dir($base)) {
        continue;
    }
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base));
    foreach ($it as $file) {
        if (!$file->isFile() || $file->getExtension() !== 'php') {
            continue;
        }
        $path = $file->getPathname();
        if (strpos($path, DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR) !== false) {
            continue;
        }
        $content = file_get_contents($path);
        if ($content === false) {
            continue;
        }
        $orig = $content;
        foreach ($includesFiles as $inc) {
            $content = preg_replace(
                '#require_once\s+__DIR__\s*\.\s*["\']/' . preg_quote($inc, '#') . '["\']\s*;#',
                'require_once dirname(__DIR__) . "/includes/' . $inc . '";',
                $content
            );
        }
        $content = preg_replace(
            '#require_once\s+__DIR__\s*\.\s*["\']/ecocheck/#',
            'require_once dirname(__DIR__) . "/ecocheck/',
            $content
        );
        if ($content !== $orig) {
            file_put_contents($path, $content);
            $phpFixed++;
        }
    }
}

$rewrites = <<<'HTA'

<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /Ecocoleta/

RewriteRule ^login\.html$ auth/login.html [L]
RewriteRule ^login\.php$ auth/login.php [L]
RewriteRule ^cadastro\.html$ auth/cadastro.html [L]
RewriteRule ^cadastro\.php$ auth/cadastro.php [L]
RewriteRule ^Login-ADM\.html$ admin/Login-ADM.html [L]
RewriteRule ^Login-ADM\.php$ admin/Login-ADM.php [L]
RewriteRule ^Login-ADM-Ecoponto\.html$ admin/Login-ADM-Ecoponto.html [L]
RewriteRule ^tela-inicia\.html$ pages/tela-inicia.html [L]
RewriteRule ^ecopontos\.html$ pages/ecopontos.html [L]
RewriteRule ^perfil\.html$ pages/perfil.html [L]
RewriteRule ^ecocheck-api\.php$ api/ecocheck-api.php [L]
RewriteRule ^logout\.php$ api/logout.php [L]
RewriteRule ^home\.css$ assets/css/home.css [L]
RewriteRule ^style\.css$ assets/css/style.css [L]
RewriteRule ^mapa\.js$ mapa/mapa.js [L]
RewriteRule ^mapa\.css$ mapa/mapa.css [L]
</IfModule>
HTA;

$htaccess = $root . DIRECTORY_SEPARATOR . '.htaccess';
$current = is_file($htaccess) ? file_get_contents($htaccess) : '';
if (strpos($current, '# EcoColeta rewrites') === false) {
    $current = preg_replace(
        '/DirectoryIndex\s+.+/',
        'DirectoryIndex pages/tela-inicia.html index.html',
        $current,
        1
    );
    file_put_contents($htaccess, rtrim($current) . "\n" . $rewrites);
    $log[] = '.htaccess atualizado';
}

$rootFiles = array_values(array_filter(scandir($root) ?: [], static function ($f) use ($root) {
    return $f !== '.' && $f !== '..' && is_file($root . DIRECTORY_SEPARATOR . $f);
}));

echo "=== EcoColeta estrutura aplicada ===\n\n";
echo implode("\n", $log) . "\n\n";
echo "PHP corrigidos: $phpFixed\n\n";
echo "Arquivos na raiz (" . count($rootFiles) . "):\n";
echo implode("\n", $rootFiles) . "\n";
