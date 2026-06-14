<?php

$root = dirname(__DIR__);

$includesFiles = [
    'conexao.php', 'email_helper.php', 'senha-validacao.php', 'stmt_helpers.php',
    'notificacoes_helper.php', 'admin-plataforma-helpers.php', 'admin-ecoponto-helpers.php',
    'admin-plataforma-session.php', 'admin-ecoponto-session.php', 'edicaoperfil_body.inc.php',
];

$scanDirs = ['api', 'auth', 'admin', 'includes', 'pages', 'mapa', 'uploads'];
$fixed = 0;

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
        $content = file_get_contents($path);
        if ($content === false) {
            continue;
        }
        $orig = $content;
        $depth = substr_count(str_replace($root, '', dirname($path)), DIRECTORY_SEPARATOR);
        $up = $depth > 0 ? str_repeat('/..', $depth) : '';
        $prefix = $up === '' ? '__DIR__' : '__DIR__ . "' . $up . '"';

        foreach ($includesFiles as $inc) {
            $content = preg_replace(
                '#require_once\s+__DIR__\s*\.\s*["\']/' . preg_quote($inc, '#') . '["\']\s*;#',
                'require_once dirname(__DIR__) . "/includes/' . $inc . '";',
                $content
            );
            $content = preg_replace(
                '#require\s+__DIR__\s*\.\s*["\']/' . preg_quote($inc, '#') . '["\']\s*;#',
                'require dirname(__DIR__) . "/includes/' . $inc . '";',
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
            $fixed++;
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
RewriteRule ^recuperar\.html$ auth/recuperar.html [L]
RewriteRule ^nova-senha\.html$ auth/nova-senha.html [L]
RewriteRule ^verificacao\.html$ auth/verificacao.html [L]
RewriteRule ^verificar-cadastro\.html$ auth/verificar-cadastro.html [L]
RewriteRule ^verificar_cadastro\.php$ auth/verificar_cadastro.php [L]
RewriteRule ^resetar_senha\.php$ auth/resetar_senha.php [L]

RewriteRule ^Login-ADM\.html$ admin/Login-ADM.html [L]
RewriteRule ^Login-ADM\.php$ admin/Login-ADM.php [L]
RewriteRule ^Login-ADM-Ecoponto\.html$ admin/Login-ADM-Ecoponto.html [L]
RewriteRule ^Login-ADM-Ecoponto\.php$ admin/Login-ADM-Ecoponto.php [L]
RewriteRule ^Home-ADM\.html$ admin/Home-ADM.html [L]
RewriteRule ^Home-ADM-Ecoponto\.html$ admin/Home-ADM-Ecoponto.html [L]

RewriteRule ^tela-inicia\.html$ pages/tela-inicia.html [L]
RewriteRule ^ecopontos\.html$ pages/ecopontos.html [L]
RewriteRule ^perfil\.html$ pages/perfil.html [L]
RewriteRule ^agendar-coleta\.html$ pages/agendar-coleta.html [L]
RewriteRule ^Ranking\.html$ pages/Ranking.html [L]
RewriteRule ^quem-somos\.html$ pages/quem-somos.html [L]
RewriteRule ^como-funciona\.html$ pages/como-funciona.html [L]
RewriteRule ^premios-disponiveis\.html$ pages/premios-disponiveis.html [L]
RewriteRule ^edicaoperfil\.html$ pages/edicaoperfil.html [L]
RewriteRule ^educacao-ambiental\.html$ pages/educacao-ambiental.html [L]
RewriteRule ^pagina-relatorio\.html$ pages/pagina-relatorio.html [L]
RewriteRule ^relatorio-mensal\.html$ pages/relatorio-mensal.html [L]
RewriteRule ^formulario-coleta\.html$ pages/formulario-coleta.html [L]
RewriteRule ^mapa\.html$ pages/mapa.html [L]

RewriteRule ^ecocheck-api\.php$ api/ecocheck-api.php [L]
RewriteRule ^logout\.php$ api/logout.php [L]
RewriteRule ^agendamento_coleta\.php$ api/agendamento_coleta.php [L]
RewriteRule ^notificacoes\.php$ api/notificacoes.php [L]
RewriteRule ^meu_perfil\.php$ api/meu_perfil.php [L]
RewriteRule ^geocode-nominatim\.php$ api/geocode-nominatim.php [L]

RewriteRule ^home\.css$ assets/css/home.css [L]
RewriteRule ^style\.css$ assets/css/style.css [L]
RewriteRule ^header\.css$ assets/css/header.css [L]
RewriteRule ^footer\.css$ assets/css/footer.css [L]
RewriteRule ^mapa\.js$ mapa/mapa.js [L]
RewriteRule ^mapa\.css$ mapa/mapa.css [L]
RewriteRule ^home\.js$ assets/js/home.js [L]
RewriteRule ^header-nav\.js$ assets/js/header-nav.js [L]
RewriteRule ^footer\.js$ assets/js/footer.js [L]
</IfModule>
HTA;

$htaccess = $root . DIRECTORY_SEPARATOR . '.htaccess';
$current = is_file($htaccess) ? file_get_contents($htaccess) : '';
if (strpos($current, '# EcoColeta rewrites') === false) {
    $marker = "# EcoColeta rewrites\n";
    if (strpos($current, 'DirectoryIndex') !== false) {
        $current = preg_replace(
            '/DirectoryIndex\s+.+/',
            "DirectoryIndex pages/tela-inicia.html index.html",
            $current,
            1
        );
    }
    file_put_contents($htaccess, rtrim($current) . "\n" . $marker . $rewrites);
}

header('Content-Type: text/plain; charset=utf-8');
echo "fix-paths: {$fixed} arquivo(s) PHP atualizado(s).\n.htaccess atualizado.\n";
