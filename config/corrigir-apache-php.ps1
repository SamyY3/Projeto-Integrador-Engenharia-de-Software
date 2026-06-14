
$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    Write-Host ""
    Write-Host "ERRO: precisa rodar como Administrador." -ForegroundColor Red
    Write-Host "Clique direito em corrigir-apache-php.ps1 -> Executar com PowerShell (admin)"
    Write-Host ""
    Read-Host "Enter para fechar"
    exit 1
}

$xamppRoots = @(
    "C:\xampp",
    "$env:LocalAppData\Programs\XAMPP",
    "D:\xampp"
)

$httpdConf = $null
foreach ($root in $xamppRoots) {
    $c = Join-Path $root "apache\conf\httpd.conf"
    if (Test-Path -LiteralPath $c) {
        $httpdConf = $c
        break
    }
}

if (-not $httpdConf) {
    Write-Host "Nao encontrei httpd.conf do XAMPP (C:\xampp, etc.)." -ForegroundColor Red
    Read-Host "Enter para fechar"
    exit 1
}

Write-Host "Usando: $httpdConf" -ForegroundColor Cyan

$xamppExtra = Join-Path (Split-Path $httpdConf) "extra\httpd-xampp.conf"
if (-not (Test-Path -LiteralPath $xamppExtra)) {
    Write-Host "Arquivo faltando: $xamppExtra" -ForegroundColor Red
    Read-Host "Enter para fechar"
    exit 1
}

$dllCandidates = @(
    (Join-Path (Split-Path (Split-Path $httpdConf)) "php\php8apache2_4.dll"),
    (Join-Path (Split-Path (Split-Path $httpdConf)) "php\php7apache2_4.dll")
)
$dllOk = $false
foreach ($d in $dllCandidates) {
    if (Test-Path -LiteralPath $d) {
        Write-Host "OK: DLL do PHP encontrada: $d" -ForegroundColor Green
        $dllOk = $true
        break
    }
}
if (-not $dllOk) {
    Write-Host "AVISO: nao achei php8apache2_4.dll na pasta php do XAMPP." -ForegroundColor Yellow
    Write-Host "Se o Apache nao executar PHP, reinstale o XAMPP completo (Apache + PHP)." -ForegroundColor Yellow
}

$lines = [System.IO.File]::ReadAllLines($httpdConf)
$hasActive = $false
foreach ($line in $lines) {
    if ($line -match '^\s*Include\s+"conf/extra/httpd-xampp\.conf"\s*$') {
        $hasActive = $true
        break
    }
}

if ($hasActive) {
    Write-Host "OK: httpd.conf ja inclui httpd-xampp.conf (e la que fica LoadModule php_module)." -ForegroundColor Green
    Write-Host "Se o PHP ainda aparece como texto no navegador, use INICIAR-PROJETO.bat" -ForegroundColor Yellow
    Read-Host "Enter para fechar"
    exit 0
}

$backup = "$httpdConf.bak-ecocoleta-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $httpdConf -Destination $backup
Write-Host "Backup: $backup" -ForegroundColor DarkGray

$newLines = New-Object System.Collections.Generic.List[string]
$changed = $false
foreach ($line in $lines) {
    if ($line -match '^\s*#\s*Include\s+"conf/extra/httpd-xampp\.conf"\s*$') {
        $newLines.Add('Include "conf/extra/httpd-xampp.conf"')
        $changed = $true
    } else {
        $newLines.Add($line)
    }
}

$text = [string]::Join([Environment]::NewLine, $newLines)
if ($text -notmatch 'Include\s+"conf/extra/httpd-xampp\.conf"') {
    $list2 = New-Object System.Collections.Generic.List[string]
    $inserted = $false
    foreach ($line in $newLines) {
        $list2.Add($line)
        if (-not $inserted -and $line -match 'Include\s+"conf/extra/httpd-default\.conf"') {
            $list2.Add('# EcoColeta: garantir PHP no Apache (XAMPP)')
            $list2.Add('Include "conf/extra/httpd-xampp.conf"')
            $inserted = $true
            $changed = $true
        }
    }
    if ($inserted) {
        $newLines = $list2
    }
}

if (-not $changed) {
    Write-Host "Nao foi possivel ajustar automaticamente. Veja COMO_RODAR_O_PROJETO.txt" -ForegroundColor Yellow
    Read-Host "Enter para fechar"
    exit 0
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($httpdConf, $newLines, $utf8NoBom)

Write-Host ""
Write-Host "Pronto: httpd.conf foi atualizado." -ForegroundColor Green
Write-Host "1) Abra o XAMPP e clique em Stop no Apache, depois Start."
Write-Host "2) Teste: http://localhost/Ecocoleta/test-php-json.php"
Write-Host "   Deve aparecer so: {""php_executado"":true,""ok"":true}"
Write-Host ""
Read-Host "Enter para fechar"
