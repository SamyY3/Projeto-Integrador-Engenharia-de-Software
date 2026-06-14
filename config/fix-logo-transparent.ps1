Add-Type -AssemblyName System.Drawing

$src = (Join-Path $PSScriptRoot "..\assets\images\logo.2.png" | Resolve-Path).Path
$bak = (Join-Path $PSScriptRoot "..\assets\images\logo.2.bak.png" | Resolve-Path).Path

if (-not (Test-Path $bak)) {
    Copy-Item $src $bak
    Write-Host "Backup: $bak"
}

$bmp = New-Object System.Drawing.Bitmap($src)
$w = $bmp.Width
$h = $bmp.Height

$pts = @(
    [System.Drawing.Point]::new(1, 1),
    [System.Drawing.Point]::new($w - 2, 1),
    [System.Drawing.Point]::new(1, $h - 2),
    [System.Drawing.Point]::new($w - 2, $h - 2)
)
$rs = 0; $gs = 0; $bs = 0
foreach ($p in $pts) {
    $c = $bmp.GetPixel($p.X, $p.Y)
    $rs += $c.R; $gs += $c.G; $bs += $c.B
}
$bgR = [int][Math]::Round($rs / $pts.Count)
$bgG = [int][Math]::Round($gs / $pts.Count)
$bgB = [int][Math]::Round($bs / $pts.Count)
Write-Host "BG médio: $bgR,$bgG,$bgB"

$tol = 48
$soft = $tol + 28

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $c = $bmp.GetPixel($x, $y)
        $dr = $c.R - $bgR
        $dg = $c.G - $bgG
        $db = $c.B - $bgB
        $d = [Math]::Sqrt($dr * $dr + $dg * $dg + $db * $db)
        if ($d -le $tol) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $c.R, $c.G, $c.B))
        }
        elseif ($d -lt $soft) {
            $fade = [int][Math]::Round(255 * (($d - $tol) / ($soft - $tol)))
            $fade = [Math]::Max(0, [Math]::Min(255, $fade))
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($fade, $c.R, $c.G, $c.B))
        }
    }
}

$tmp = "$src.tmp.png"
$bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Move-Item -Path $tmp -Destination $src -Force
Write-Host "Salvo: $src (${w}x${h})"
