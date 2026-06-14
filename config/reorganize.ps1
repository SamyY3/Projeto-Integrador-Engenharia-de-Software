$ErrorActionPreference = "Continue"
$root = "C:\xampp\htdocs\Ecocoleta"
Set-Location $root

function Ensure-Dir($path) {
    if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
}

$dirs = @(
    "api", "auth", "admin", "pages",
    "assets/css", "assets/js", "assets/images",
    "database", "includes", "config", "mapa", "ecocheck-dist"
)
foreach ($d in $dirs) { Ensure-Dir (Join-Path $root $d) }

function Resolve-RootFile($name, $destDir) {
    $src = Join-Path $root $name
    if (-not (Test-Path $src)) { return }
    $destFolder = Join-Path $root $destDir
    Ensure-Dir $destFolder
    $dest = Join-Path $destFolder $name
    if (Test-Path $dest) {
        Remove-Item -LiteralPath $src -Force
        Write-Host "Dup removido: $name (mantido em $destDir/)"
    } else {
        Move-Item -LiteralPath $src -Destination $destFolder -Force
        Write-Host "Movido: $name -> $destDir/"
    }
}

@(
    "SQL_BDD_EcoColeta.sql", "usuario_edicao_opcional.sql", "corrigir_tipo_expiracao_codigo.sql",
    "premios_beneficios_resgate.sql", "agendamento_coleta_tab.sql", "cadastro_pendente_tab.sql",
    "notificacao_tab.sql", "alter_recuperacao_usuario.sql"
) | ForEach-Object { Resolve-RootFile $_ "database" }

@(
    "conexao.php", "conexao.config.example.php", "conexcao.php",
    "email_helper.php", "senha-validacao.php", "stmt_helpers.php", "notificacoes_helper.php",
    "admin-plataforma-helpers.php", "admin-ecoponto-helpers.php",
    "admin-plataforma-session.php", "admin-ecoponto-session.php",
    "edicaoperfil_body.inc.php"
) | ForEach-Object { Resolve-RootFile $_ "includes" }

@(
    "apache-ecocoleta-php.conf", "smtp_settings.json", "smtp_settings.example.json",
    "DEPLOY.md", "COMO_RODAR.txt", "COMO_RODAR_O_PROJETO.txt", "LEIA-ME_PHP.txt",
    "COMO_CONFIGURAR_EMAIL.txt",
    "INSTALAR-BANCO.bat", "INICIAR-PROJETO.bat", "diagnostico-porta80.bat",
    "desligar-iis-admin.bat", "iniciar-servidor-php.bat",
    "corrigir-apache-php.ps1", "garantir-php-sem-bom.ps1", "instalar-php-apache-ecocoleta.ps1",
    "mysql_start_output.txt"
) | ForEach-Object { Resolve-RootFile $_ "config" }

@(
    "login.html", "login.php", "cadastro.html", "cadastro.php",
    "recuperar.html", "recuperar.php", "nova-senha.html", "resetar.html", "resetar_senha.php",
    "verificacao.html", "verificar-cadastro.html", "verificar_cadastro.php",
    "senha-criada.html", "verificar_codigo_recuperacao.php", "vc.php", "login-temp.html"
) | ForEach-Object { Resolve-RootFile $_ "auth" }

@(
    "Login-ADM.html", "Login-ADM.php", "Login-ADM.css",
    "Login-ADM-Ecoponto.html", "Login-ADM-Ecoponto.php", "Login-ADM-Ecoponto.css",
    "Home-ADM.html", "home-adm.css", "home-adm.js",
    "Home-ADM-Ecoponto.html", "home-adm-ecoponto.css", "home-adm-ecoponto.js",
    "edicao-perfil-admin.html", "edicao-perfil-admin.css", "edicao-perfil-admin.js",
    "configuracoes-ADM-Ecoponto.html", "configuracoes-adm-ecoponto.css", "configuracoes-adm-ecoponto.js",
    "configuracoes-adm.html", "relatorio-ADM-Ecoponto.html", "relatorio-adm-ecoponto.css", "relatorio-adm-ecoponto.js",
    "relatorio-adm.html", "relatorio-adm.css", "relatorio-adm.js",
    "materias-ADM-Ecoponto.html", "materias-adm-ecoponto.css", "materias-adm-ecoponto.js",
    "coletas-ADM-Ecoponto.html", "Coletas-ADM-Ecoponto.html", "coletas-adm-ecoponto.css", "coletas-adm-ecoponto.js",
    "agendamento-adm.html", "ecoponto-adm.html", "usuarios-adm.html", "mapa-publico-adm.html",
    "adm-sidebar-icons.js", "adm-sidebar-icons.svg",
    "login-adm-pontos.php"
) | ForEach-Object { Resolve-RootFile $_ "admin" }

@(
    "ecocheck-api.php", "agendamento_coleta.php", "agendamento_coleta_api.php",
    "geocode-nominatim.php", "notificacoes.php", "logout.php", "meu_perfil.php",
    "resgate_premio.php", "registrar_entrega.php", "excluir_conta.php",
    "atualizar-nome.php", "atualizar-perfil.php", "atualizar-perfil-admin.php",
    "atualizarperfil.php", "atualizar_nome.php",
    "configuracoes-adm-ecoponto.php", "meu-perfil-admin.php",
    "edicaoperfil.php", "test-php-json.php"
) | ForEach-Object { Resolve-RootFile $_ "api" }

@(
    "tela-inicia.html", "ecopontos.html", "perfil.html", "educacao-ambiental.html",
    "agendar-coleta.html", "pagina-relatorio.html", "relatorio.html", "Ranking.html", "quem-somos.html",
    "edicaoperfil.html", "como-funciona.html", "premios-disponiveis.html",
    "formulario-coleta.html", "relatorio-mensal.html", "notif-popup.html", "mapa.html", "balanca-ecoponto.html", "apoiador.html"
) | ForEach-Object { Resolve-RootFile $_ "pages" }

@("mapa.js", "mapa.css") | ForEach-Object { Resolve-RootFile $_ "mapa" }
Resolve-RootFile "transport-times-widget.js" "assets/js"

@(
    "style.css", "home.css", "header.css", "footer.css", "premios.css", "ranking.css",
    "perfil.css", "perfil-avatar.css", "user-popup.css", "notif-popup.css",
    "agendar-coleta.css", "pagina-relatorio.css", "relatorio-mensal.css",
    "educacao-ambiental.css", "ecopontos.css", "quem-somos.css", "como-funciona.css",
    "edicaoperfil.css", "ecocheck-widget.css", "anti-bot.css"
) | ForEach-Object { Resolve-RootFile $_ "assets/css" }

@(
    "home.js", "header-nav.js", "header-scroll.js", "footer.js",
    "premios.js", "ranking.js", "perfil.js", "perfil-avatar.js", "user-popup.js",
    "notif-popup.js", "agendar-coleta.js", "edicaoperfil.js", "ecopontos.js",
    "password-toggle.js", "ecocheck-bridge.js", "anti-bot.js", "validate_html.js"
) | ForEach-Object { Resolve-RootFile $_ "assets/js" }

if (Test-Path (Join-Path $root "Imagens")) {
    Get-ChildItem (Join-Path $root "Imagens") | ForEach-Object {
        $target = Join-Path (Join-Path $root "assets/images") $_.Name
        if (Test-Path $target) { Remove-Item $_.FullName -Force }
        else { Move-Item -LiteralPath $_.FullName -Destination (Join-Path $root "assets/images") -Force }
    }
    Remove-Item (Join-Path $root "Imagens") -Recurse -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path (Join-Path $root "ecocheck-bridge.js"))) {
    if (Test-Path (Join-Path $root "assets/js/ecocheck-bridge.js")) {
        Copy-Item (Join-Path $root "assets/js/ecocheck-bridge.js") (Join-Path $root "ecocheck-bridge.js")
    }
}
if (-not (Test-Path (Join-Path $root "ecocheck-widget.css"))) {
    if (Test-Path (Join-Path $root "assets/css/ecocheck-widget.css")) {
        Copy-Item (Join-Path $root "assets/css/ecocheck-widget.css") (Join-Path $root "ecocheck-widget.css")
    }
}

Write-Host "Movimentacao concluida."
