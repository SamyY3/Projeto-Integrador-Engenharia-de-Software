
$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    Write-Host "Execute este script COMO ADMINISTRADOR." -ForegroundColor Red
    Read-Host "Enter"
    exit 1
}

$xampp = "C:\xampp"
if (-not (Test-Path "$xampp\apache\conf\httpd.conf")) {
    $alt = "$env:LocalAppData\Programs\XAMPP"
    if (Test-Path "$alt\apache\conf\httpd.conf") { $xampp = $alt }
    else {
        Write-Host "XAMPP nao encontrado em C:\xampp. Edite a variavel `$xampp neste script." -ForegroundColor Red
        Read-Host "Enter"
        exit 1
    }
}

$phpDir = Join-Path $xampp "php"
$dll = Join-Path $phpDir "php8apache2_4.dll"
if (-not (Test-Path $dll)) {
    Write-Host "ERRO: nao existe: $dll" -ForegroundColor Red
    Write-Host "Instale o pacote COMPLETO do XAMPP (Apache + PHP) ou reinstale." -ForegroundColor Yellow
    Read-Host "Enter"
    exit 1
}

$extraDir = Join-Path $xampp "apache\conf\extra"
$outConf = Join-Path $extraDir "apache-ecocoleta-php.conf"

$phpTs = Join-Path $phpDir "php8ts.dll"
if (-not (Test-Path $phpTs)) {
    $phpTs = Join-Path $phpDir "php7ts.dll"
}

$dllPath = $dll -replace '\\', '/'
$phpTsPath = $phpTs -replace '\\', '/'
$libpq = (Join-Path $phpDir "libpq.dll") -replace '\\', '/'
$libsql = (Join-Path $phpDir "libsqlite3.dll") -replace '\\', '/'
$phpDirUnix = $phpDir -replace '\\', '/'

$confBody = @"
<IfModule !php_module>
LoadFile "$phpTsPath"
LoadFile "$libpq"
LoadFile "$libsql"
LoadModule php_module "$dllPath"
<FilesMatch `"\.php`$`">
    SetHandler application/x-httpd-php
</FilesMatch>
</IfModule>

<IfModule php_module>
    PHPINIDir "$phpDirUnix"
</IfModule>
"@

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outConf, $confBody.TrimEnd() + "`r`n", $utf8)
Write-Host "Criado: $outConf" -ForegroundColor Green

$httpdConf = Join-Path $xampp "apache\conf\httpd.conf"
$lines = [System.IO.File]::ReadAllLines($httpdConf)
$includeLine = 'Include "conf/extra/apache-ecocoleta-php.conf"'
$found = $false
foreach ($line in $lines) {
    if ($line.Trim() -eq $includeLine) { $found = $true; break }
}
if (-not $found) {
    $bak = "$httpdConf.bak-ecocoleta-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $httpdConf $bak
    $list = New-Object System.Collections.Generic.List[string]
    foreach ($line in $lines) { $list.Add($line) }
    $list.Add('')
    $list.Add('# EcoColeta: garantir PHP (se ainda nao carregou)')
    $list.Add($includeLine)
    [System.IO.File]::WriteAllLines($httpdConf, $list, $utf8)
    Write-Host "httpd.conf atualizado. Backup: $bak" -ForegroundColor Green
} else {
    Write-Host "httpd.conf ja tinha Include apache-ecocoleta-php.conf" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "1) XAMPP -> Stop Apache -> Start Apache" -ForegroundColor Yellow
Write-Host "2) Teste: http://localhost/Ecocoleta/test-php-json.php" -ForegroundColor Yellow
Write-Host "   Deve mostrar SO: {""php_executado"":true,""ok"":true}" -ForegroundColor Yellow
Write-Host ""
Write-Host "Se AINDA mostrar codigo PHP, outro programa pode estar na porta 80 (IIS)." -ForegroundColor Yellow
Write-Host "Rode diagnostico-porta80.bat e use INICIAR-PROJETO.bat (http://localhost/Ecocoleta/)." -ForegroundColor Yellow
Read-Host "Enter"
