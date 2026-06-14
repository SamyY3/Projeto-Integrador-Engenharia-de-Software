$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent
$baseUrl = "http://localhost/Ecocoleta"
$reportPath = Join-Path $root "docs\QA-RELATORIO-CAIXAS-PRETA-BRANCA.md"
$csvPath = Join-Path $root "docs\QA-resultados.csv"

function Get-PageCategory {
  param([string]$RelPath)
  if ($RelPath -eq "index.html") { return "Raiz" }
  if ($RelPath -like "pages\*") { return "Publico" }
  if ($RelPath -like "auth\*") { return "Auth" }
  if ($RelPath -like "admin\*") { return "Admin" }
  if ($RelPath -like "mapa\*") { return "Mapa" }
  return "Outro"
}

function Get-PageUrl {
  param([string]$RelPath)
  if ($RelPath -eq "index.html") { return "/" }
  return "/" + ($RelPath -replace '\\', '/')
}

$htmlFiles = Get-ChildItem -Path $root -Filter "*.html" -Recurse -File |
  Where-Object {
    $_.FullName -notmatch '\\vendor\\|\\node_modules\\|\\ecocheck\\dist\\|\\ecocheck\\'
  } |
  ForEach-Object { $_.FullName.Substring($root.Length + 1) } |
  Sort-Object -Unique

$pages = foreach ($rel in $htmlFiles) {
  @{
    Path = $rel
    Url  = (Get-PageUrl -RelPath $rel)
    Cat  = (Get-PageCategory -RelPath $rel)
  }
}

$apiEndpoints = @(
  @{ Path = "api/ecocheck-api.php?action=status"; Method = "GET"; ExpectJson = $true },
  @{ Path = "api/meu_perfil.php"; Method = "GET"; ExpectJson = $true },
  @{ Path = "api/notificacoes.php"; Method = "GET"; ExpectJson = $true },
  @{ Path = "api/logout.php"; Method = "GET"; ExpectJson = $false },
  @{ Path = "api/listar-ecopontos.php"; Method = "GET"; ExpectJson = $true },
  @{ Path = "api/ranking.php"; Method = "GET"; ExpectJson = $true },
  @{ Path = "api/ranking-ruas.php"; Method = "GET"; ExpectJson = $true }
)

function Get-ProjectRootFromPage {
  param([string]$PageDir)
  $rel = $PageDir.Substring($root.Length).TrimStart('\')
  if ($rel -match '^(pages|auth|admin|mapa)\\') {
    return $root
  }
  return $PageDir
}

function Resolve-AssetPath {
  param([string]$PageDir, [string]$Ref, [string]$BaseHref = "")
  if ($Ref -match '^(https?:)?//|^data:|^mailto:|^tel:|^#') { return $null }
  $ref = ($Ref -split '#')[0] -replace '\?.*$', ''
  if (-not $ref) { return $null }

  $projRoot = Get-ProjectRootFromPage -PageDir $PageDir
  $baseDir = $PageDir

  if ($BaseHref) {
    try {
      $baseDir = [System.IO.Path]::GetFullPath((Join-Path $PageDir $BaseHref))
    } catch {
      $baseDir = $projRoot
    }
  } elseif ($PageDir -match '\\(pages|auth|admin|mapa)$') {
    $baseDir = $projRoot
  }

  if ($ref -match '^\.\./') {
    $combined = [System.IO.Path]::GetFullPath((Join-Path $baseDir ($ref -replace '/', '\')))
  } elseif ($ref -match '^\./') {
    $combined = [System.IO.Path]::GetFullPath((Join-Path $baseDir ($ref -replace '^\./', '' -replace '/', '\')))
  } else {
    $combined = [System.IO.Path]::GetFullPath((Join-Path $baseDir ($ref -replace '/', '\')))
  }
  return $combined
}

function Get-BaseHrefFromHtml {
  param([string]$Html)
  $m = [regex]::Match($Html, '<base[^>]+href=["'']([^"'']+)["'']')
  if ($m.Success) { return $m.Groups[1].Value }
  return ""
}

function Test-WhiteBoxPhp {
  param([string]$FilePath)
  $issues = @()
  if (-not (Test-Path $FilePath)) { return $issues }
  $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
  if (-not $content) { return $issues }
  $dir = Split-Path $FilePath -Parent
  $matches = [regex]::Matches($content, 'require(?:_once)?\s+__DIR__\s*\.\s*["''](/[^"'']+)["'']')
  foreach ($m in $matches) {
    $rel = $m.Groups[1].Value -replace '/', '\'
    $target = Join-Path $dir $rel.TrimStart('\')
    if (-not (Test-Path $target)) {
      $issues += "require ausente: $($m.Groups[1].Value)"
    }
  }
  if ($content -match '__DIR__\s*\.\s*["'']/vendor/autoload') {
    $vendor = Join-Path $dir "vendor\autoload.php"
    if (-not (Test-Path $vendor)) { $issues += "vendor/autoload.php ausente" }
  }
  if ($content -match '\bsession_start\s*\(' -and $content -notmatch 'session_status|ecocoleta_session_start') {
    $issues += "session_start sem verificacao session_status (risco notice)"
  }
  return $issues
}

function Test-BlackBoxHtml {
  param([string]$Html, [string]$PagePath)
  $notes = @()
  $bbFail = @()

  if ($Html -notmatch '<html') { $bbFail += "sem tag <html>" }
  if ($Html -notmatch '<title>[^<]+</title>') { $bbFail += "title vazio ou ausente" }
  if ($Html -notmatch 'charset') { $bbFail += "charset nao declarado" }
  if ($Html -notmatch 'viewport') { $bbFail += "meta viewport ausente" }

  $subfolders = @("pages\", "auth\", "admin\", "mapa\")
  $needsBase = $subfolders | Where-Object { $PagePath -like "$_*" }
  if ($needsBase -and $Html -notmatch '<base') {
    $bbFail += "sem <base href> em subpasta"
  }

  if ($Html -match '(?:href|src)=["'']file:') {
    $bbFail += "referencia file:// no HTML"
  }

  $ids = [regex]::Matches($Html, '\sid=["'']([^"'']+)["'']') | ForEach-Object { $_.Groups[1].Value }
  $dupIds = $ids | Group-Object | Where-Object { $_.Count -gt 1 } | Select-Object -ExpandProperty Name
  if ($dupIds) {
    $notes += "IDs duplicados: $($dupIds -join ', ')"
  }

  if ($Html -match 'loading=["'']lazy["'']' -and $Html -match 'auth-logo-img|eco-brand-img') {
    $notes += "logo com loading=lazy (LCP)"
  }

  return @{ Fail = $bbFail; Notes = $notes }
}

$results = @()
$serverOk = $false
try {
  $ping = Invoke-WebRequest -Uri "$baseUrl/index.html" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
  $serverOk = $ping.StatusCode -eq 200
} catch {
  $serverOk = $false
}

foreach ($p in $pages) {
  $full = Join-Path $root $p.Path
  $pageDir = Split-Path $full -Parent
  $row = [ordered]@{
    Page           = $p.Path
    Category       = $p.Cat
    FileExists     = Test-Path $full
    HttpStatus     = $null
    HttpLegacy     = $null
    BrokenAssets   = @()
    MissingScripts = @()
    BlackBoxFail   = @()
    WhiteBox       = @()
    Notes          = @()
    BlackBox       = "PENDENTE"
    WhiteBoxStatus = "PENDENTE"
  }

  if (-not $row.FileExists) {
    $row.BlackBox = "FALHA"
    $row.WhiteBoxStatus = "N/A"
    $results += [pscustomobject]$row
    continue
  }

  $html = Get-Content $full -Raw -Encoding UTF8
  $baseHref = Get-BaseHrefFromHtml -Html $html
  $bb = Test-BlackBoxHtml -Html $html -PagePath $p.Path
  $row.BlackBoxFail = $bb.Fail
  $row.Notes = $bb.Notes
  if ($bb.Fail.Count -eq 0) { $row.BlackBox = "OK" } else { $row.BlackBox = "FALHA" }

  $refs = [regex]::Matches($html, '(?:href|src)=["'']([^"'']+)["'']') | ForEach-Object { $_.Groups[1].Value }
  foreach ($ref in $refs) {
    $cleanRef = ($ref -split '#')[0] -replace '\?.*$', ''
    if ($cleanRef -match '\.html?$' -and $cleanRef -notmatch '\.php') { continue }
    $resolved = Resolve-AssetPath -PageDir $pageDir -Ref $ref -BaseHref $baseHref
    if ($resolved -and -not (Test-Path $resolved)) {
      $row.BrokenAssets += $ref
    }
  }

  $scripts = [regex]::Matches($html, '<script[^>]+src=["'']([^"'']+)["'']') | ForEach-Object { $_.Groups[1].Value }
  foreach ($s in $scripts) {
    if ($s -match '^https?://') { continue }
    $resolved = Resolve-AssetPath -PageDir $pageDir -Ref $s -BaseHref $baseHref
    if ($resolved -and -not (Test-Path $resolved)) {
      $row.MissingScripts += $s
    }
  }

  if ($row.BrokenAssets.Count -gt 0 -or $row.MissingScripts.Count -gt 0) {
    $row.BlackBox = "FALHA"
  }

  $phpSibling = [System.IO.Path]::ChangeExtension($full, ".php")
  $wbIssues = @()
  if (Test-Path $phpSibling) {
    $wbIssues += Test-WhiteBoxPhp -FilePath $phpSibling
  }

  $actions = [regex]::Matches($html, '<form[^>]+action=["'']([^"'']+)["'']') | ForEach-Object { $_.Groups[1].Value }
  foreach ($act in $actions) {
    if ($act -match '^https?://|^\#') { continue }
    $resolved = Resolve-AssetPath -PageDir $pageDir -Ref $act -BaseHref $baseHref
    if ($resolved -and -not (Test-Path $resolved)) {
      $wbIssues += "form action inexistente: $act"
    }
  }

  $row.WhiteBox = $wbIssues
  if ($wbIssues.Count -eq 0) { $row.WhiteBoxStatus = "OK" } else { $row.WhiteBoxStatus = "FALHA" }

  if ($serverOk) {
    try {
      $r = Invoke-WebRequest -Uri ($baseUrl + $p.Url) -UseBasicParsing -TimeoutSec 15 -MaximumRedirection 5
      $row.HttpStatus = $r.StatusCode
      if ($r.StatusCode -ne 200) { $row.BlackBox = "FALHA" }
    } catch {
      $row.HttpStatus = "ERR"
      $row.BlackBox = "FALHA"
    }
    $legacyName = Split-Path $p.Path -Leaf
    if ($legacyName -ne "index.html" -and $p.Path -notlike "admin\*" -and $p.Path -notlike "mapa\*") {
      try {
        $r2 = Invoke-WebRequest -Uri ($baseUrl + "/" + $legacyName) -UseBasicParsing -TimeoutSec 12 -MaximumRedirection 5
        $row.HttpLegacy = $r2.StatusCode
      } catch {
        $row.HttpLegacy = "ERR"
      }
    }
  }

  $results += [pscustomobject]$row
}

$phpIssues = @()
Get-ChildItem -Path @(
  (Join-Path $root "api"),
  (Join-Path $root "auth"),
  (Join-Path $root "admin"),
  (Join-Path $root "includes")
) -Filter "*.php" -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\vendor\\' } |
  ForEach-Object {
    $iss = Test-WhiteBoxPhp -FilePath $_.FullName
    if ($iss.Count -gt 0) {
      $phpIssues += [pscustomobject]@{ File = $_.FullName.Replace($root + '\', ''); Issues = ($iss -join '; ') }
    }
  }

$apiResults = @()
if ($serverOk) {
  foreach ($ep in $apiEndpoints) {
    try {
      $r = Invoke-WebRequest -Uri "$baseUrl/$($ep.Path)" -Method $ep.Method -UseBasicParsing -TimeoutSec 10
      $isJson = $r.Content.TrimStart().StartsWith("{") -or $r.Content.TrimStart().StartsWith("[")
      $ok = $r.StatusCode -eq 200
      if ($ep.ExpectJson -and -not $isJson -and $r.StatusCode -ne 401) { $ok = $false }
      $apiResults += [pscustomobject]@{
        Endpoint = $ep.Path
        Status   = $r.StatusCode
        Json     = if ($isJson) { "sim" } else { "nao" }
        Result   = if ($ok) { "OK" } else { "REVISAR" }
      }
    } catch {
      $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "ERR" }
      $apiResults += [pscustomobject]@{ Endpoint = $ep.Path; Status = $code; Json = "-"; Result = "ERR" }
    }
  }
}

$smokeResults = @()
if ($serverOk) {
  try {
    $loginBody = "email=naoexiste@test.local&senha=wrong"
    $lr = Invoke-WebRequest -Uri "$baseUrl/auth/login.php" -Method POST -Body $loginBody `
      -ContentType "application/x-www-form-urlencoded" -UseBasicParsing -TimeoutSec 10
    $smokeResults += [pscustomobject]@{
      Test   = "POST login credencial invalida"
      Status = $lr.StatusCode
      Result = if ($lr.Content -match 'sucesso|erro') { "OK (JSON/resposta)" } else { "REVISAR" }
    }
  } catch {
    $smokeResults += [pscustomobject]@{ Test = "POST login"; Status = "ERR"; Result = $_.Exception.Message }
  }
}

$bbOk = ($results | Where-Object { $_.BlackBox -eq "OK" }).Count
$wbOk = ($results | Where-Object { $_.WhiteBoxStatus -eq "OK" }).Count
$total = $results.Count

$lines = @()
$lines += "# Relatorio QA - Caixa Preta e Caixa Branca (TODAS as paginas)"
$lines += ""
$lines += "Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$lines += "Raiz do projeto: ``$root``"
$serverLabel = if ($serverOk) { "ONLINE - $baseUrl" } else { "OFFLINE (testes HTTP ignorados)" }
$lines += "Servidor: **$serverLabel**"
$lines += ""
$lines += "## Resumo executivo"
$lines += ""
$lines += "| Metrica | Valor |"
$lines += "|---------|-------|"
$lines += "| Paginas HTML analisadas | **$total** |"
$lines += "| Caixa preta OK | **$bbOk / $total** |"
$lines += "| Caixa branca OK | **$wbOk / $total** |"
$lines += "| Com assets/scripts quebrados | **$(($results | Where-Object { $_.BrokenAssets.Count -gt 0 -or $_.MissingScripts.Count -gt 0 }).Count)** |"
$lines += "| HTTP != 200 | **$(($results | Where-Object { $_.HttpStatus -and $_.HttpStatus -ne 200 }).Count)** |"
$lines += "| PHP com includes ausentes | **$($phpIssues.Count)** |"
$lines += ""
$lines += "## Metodologia"
$lines += ""
$lines += "### Caixa preta"
$lines += "- Arquivo existe no disco"
$lines += "- GET HTTP 200 (Apache)"
$lines += "- URL legada na raiz (`.htaccess`)"
$lines += "- Assets `href`/`src` e scripts locais resolviveis"
$lines += "- Estrutura: `html`, `title`, `charset`, `viewport`, `base` em subpastas"
$lines += "- IDs duplicados (aviso)"
$lines += ""
$lines += "### Caixa branca"
$lines += "- `require`/`require_once` em PHP"
$lines += "- `action` de formularios"
$lines += "- Amostra de APIs REST"
$lines += "- Smoke POST login"
$lines += ""
$lines += "## Resultado por pagina"
$lines += ""
$lines += "| Pagina | Cat. | CP | CB | HTTP | Legado | Assets | Scripts |"
$lines += "|--------|------|----|----|------|--------|--------|---------|"

foreach ($r in $results) {
  $a = if ($r.BrokenAssets.Count) { $r.BrokenAssets.Count } else { "OK" }
  $s = if ($r.MissingScripts.Count) { $r.MissingScripts.Count } else { "OK" }
  $lines += "| $($r.Page) | $($r.Category) | $($r.BlackBox) | $($r.WhiteBoxStatus) | $($r.HttpStatus) | $($r.HttpLegacy) | $a | $s |"
}

$lines += ""
$lines += "## Falhas caixa preta (estrutura)"
foreach ($r in $results | Where-Object { $_.BlackBoxFail.Count -gt 0 }) {
  $lines += "### $($r.Page)"
  foreach ($f in $r.BlackBoxFail) { $lines += "- $f" }
  foreach ($n in $r.Notes) { $lines += "- _Nota:_ $n" }
  $lines += ""
}

$lines += "## Detalhes - assets/scripts ausentes"
foreach ($r in $results | Where-Object { $_.BrokenAssets.Count -gt 0 -or $_.MissingScripts.Count -gt 0 }) {
  $lines += "### $($r.Page)"
  foreach ($b in $r.BrokenAssets) { $lines += "- Asset: ``$b``" }
  foreach ($m in $r.MissingScripts) { $lines += "- Script: ``$m``" }
  $lines += ""
}

if ($phpIssues.Count -gt 0) {
  $lines += "## Caixa branca - PHP"
  foreach ($pi in $phpIssues) {
    $lines += "- **$($pi.File)**: $($pi.Issues)"
  }
  $lines += ""
}

if ($apiResults.Count -gt 0) {
  $lines += "## APIs (amostra)"
  $lines += "| Endpoint | HTTP | JSON | Resultado |"
  $lines += "|----------|------|------|-----------|"
  foreach ($ar in $apiResults) {
    $lines += "| $($ar.Endpoint) | $($ar.Status) | $($ar.Json) | $($ar.Result) |"
  }
  $lines += ""
}

if ($smokeResults.Count -gt 0) {
  $lines += "## Smoke funcional"
  foreach ($sr in $smokeResults) {
    $lines += "- **$($sr.Test)**: $($sr.Status) - $($sr.Result)"
  }
  $lines += ""
}

$lines += "## Por categoria"
foreach ($cat in @("Raiz", "Publico", "Auth", "Admin", "Mapa", "Outro")) {
  $subset = $results | Where-Object { $_.Category -eq $cat }
  if (-not $subset) { continue }
  $ok = ($subset | Where-Object { $_.BlackBox -eq "OK" }).Count
  $lines += "- **$cat**: $ok / $($subset.Count) caixa preta OK"
}

$lines += ""
$lines += "## Testes manuais (nao automatizados)"
$lines += "- Login/cadastro + EcoCheck + MySQL"
$lines += "- Admin plataforma e ecoponto (sessao)"
$lines += "- Mapa: GPS, rota, Overpass"
$lines += "- Upload avatar, resgate premios, agendamento coleta"
$lines += "- E-mail SMTP"

$null = New-Item -ItemType Directory -Path (Split-Path $reportPath) -Force -ErrorAction SilentlyContinue
$lines | Set-Content -Path $reportPath -Encoding UTF8
$results | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8

Write-Output "=== QA EcoColeta ==="
Write-Output "Report: $reportPath"
Write-Output "CSV: $csvPath"
Write-Output "Server: $serverOk"
Write-Output "Pages: $total | CP OK: $bbOk | CB OK: $wbOk"
