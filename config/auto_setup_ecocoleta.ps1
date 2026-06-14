
function AbortIfNotAdmin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Error "Execute este script como Administrador. Saindo."
        exit 1
    }
}

AbortIfNotAdmin

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$projectRoot = $projectRoot.Path
$configDir = Join-Path $projectRoot "config"

Write-Host "Projeto: $projectRoot" -ForegroundColor Cyan

$possible = @(
    'D:\XAMPP',
    'D:\xampp',
    'C:\xampp',
    'C:\XAMPP',
    "$env:LocalAppData\Programs\XAMPP"
)
$xampp = $null
foreach ($p in $possible) {
    if (Test-Path (Join-Path $p 'xampp-control.exe')) { $xampp = $p; break }
}
if (-not $xampp) {
    Write-Warning "Nao encontrei o XAMPP nos locais padrao. Por favor, instale ou ajuste manualmente."
    Write-Host "Procurei em: $($possible -join ', ')"
    exit 1
}
Write-Host "XAMPP encontrado em: $xampp" -ForegroundColor Green

$iniciarBat = Join-Path $configDir 'INICIAR-PROJETO.bat'
if (Test-Path $iniciarBat) {
    Write-Host "Executando INICIAR-PROJETO.bat..." -ForegroundColor Cyan
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$iniciarBat`"" -WindowStyle Minimized -Wait
} else {
    Write-Warning "Nao achei $iniciarBat"
}

Start-Sleep -Seconds 6

$mysqlExe = Join-Path $xampp 'mysql\bin\mysql.exe'
$instalarBat = Join-Path $configDir 'INSTALAR-BANCO.bat'
$needInstall = $false
if (Test-Path $mysqlExe) {
    Write-Host "Testando existencia do banco 'ecocoleta' via mysql.exe..." -NoNewline
    $proc = Start-Process -FilePath $mysqlExe -ArgumentList '-u','root','-e','"use ecocoleta;"' -NoNewWindow -PassThru -Wait -ErrorAction SilentlyContinue
    if ($proc.ExitCode -eq 0) { Write-Host " existe." -ForegroundColor Green } else { Write-Host " nao encontrada." -ForegroundColor Yellow; $needInstall = $true }
} else {
    Write-Warning "mysql.exe nao encontrado em $mysqlExe. Nao conseguirei testar automaticamente o banco."
    if (Test-Path $instalarBat) { $needInstall = $true }
}

if ($needInstall -and Test-Path $instalarBat) {
    Write-Host "Executando INSTALAR-BANCO.bat para criar/importar o banco..." -ForegroundColor Cyan
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$instalarBat`"" -WindowStyle Minimized -Wait
} elseif ($needInstall) {
    Write-Warning "Instalador de banco nao encontrado em $instalarBat. Importar SQL manualmente em phpMyAdmin."
}

$taskName = 'Start-EcoColeta'
$taskExists = (schtasks /Query /TN $taskName 2>$null) -ne $null
if (-not $taskExists) {
    Write-Host "Criando tarefa agendada '$taskName' para executar no logon (Admin)" -ForegroundColor Cyan
    $cmd = "schtasks /Create /SC ONLOGON /TN `"$taskName`" /TR `"cmd /c `"$iniciarBat`"`" /RL HIGHEST /F"
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -NoNewWindow -Wait
} else {
    Write-Host "Tarefa agendada '$taskName' ja existe." -ForegroundColor Yellow
}

Write-Host "Tentando configurar servicos Apache/MySQL como Automatic (se existirem)..." -ForegroundColor Cyan
$servicePatterns = @('apache','httpd','xampp','mysql','mariadb','mysqld')
Get-Service | Where-Object { $n = $_.Name.ToLower(); $d = $_.DisplayName.ToLower(); $servicePatterns | Where-Object { $n -like "*$_*" -or $d -like "*$_*" } } | ForEach-Object {
    try {
        Write-Host "Configurando: $($_.Name) ($($_.DisplayName))" -ForegroundColor Green
        sc.exe config $($_.Name) start= auto | Out-Null
    } catch {
        Write-Warning "Falha ao configurar $($_.Name): $_"
    }
}

Write-Host "Abrindo o projeto no navegador (http:
Start-Process 'http://localhost/Ecocoleta/'

Write-Host "Auto-setup concluido. Verifique mensagens acima para eventuais avisos." -ForegroundColor Magenta

