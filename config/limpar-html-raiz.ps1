$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent

$keepInRoot = @("index.html")

$destinations = @{
    "pages" = @(
        "tela-inicia.html", "ecopontos.html", "perfil.html", "educacao-ambiental.html",
        "agendar-coleta.html", "pagina-relatorio.html", "relatorio.html", "Ranking.html",
        "quem-somos.html", "edicaoperfil.html", "como-funciona.html", "premios-disponiveis.html",
        "formulario-coleta.html", "relatorio-mensal.html", "notif-popup.html", "mapa.html",
        "balanca-ecoponto.html", "apoiador.html"
    )
    "auth" = @(
        "login.html", "cadastro.html", "recuperar.html", "nova-senha.html", "verificacao.html",
        "verificar-cadastro.html", "resetar.html", "senha-criada.html", "login-temp.html"
    )
    "admin" = @(
        "Login-ADM.html", "Login-ADM-Ecoponto.html", "Home-ADM.html", "Home-ADM-Ecoponto.html",
        "Coletas-ADM-Ecoponto.html", "materias-ADM-Ecoponto.html", "relatorio-ADM-Ecoponto.html",
        "configuracoes-ADM-Ecoponto.html", "configuracoes-adm.html", "edicao-perfil-admin.html",
        "ecoponto-adm.html", "agendamento-adm.html", "usuarios-adm.html", "relatorio-adm.html",
        "mapa-publico-adm.html"
    )
}

$removed = 0
$skipped = 0

foreach ($pair in $destinations.GetEnumerator()) {
    $folder = $pair.Key
    foreach ($name in $pair.Value) {
        $src = Join-Path $root $name
        $dest = Join-Path (Join-Path $root $folder) $name
        if (-not (Test-Path $src)) { continue }
        if ($keepInRoot -contains $name) { continue }
        if (-not (Test-Path $dest)) {
            Write-Host "MANTIDO (destino ausente): $name"
            $skipped++
            continue
        }
        Remove-Item -LiteralPath $src -Force
        Write-Host "Removido da raiz: $name (-> $folder/)"
        $removed++
    }
}

Write-Host ""
Write-Host "Concluido: $removed removido(s), $skipped mantido(s) por seguranca."
Write-Host "Raiz HTML restante:"
Get-ChildItem -Path $root -Filter "*.html" -File | ForEach-Object { "  - $($_.Name)" }
