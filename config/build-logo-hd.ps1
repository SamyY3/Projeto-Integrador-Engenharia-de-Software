Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$srcPath = Join-Path $root "assets\images\telas.png"
$outPath = Join-Path $root "assets\images\logo.2.png"
$out2xPath = Join-Path $root "assets\images\logo.2@2x.png"

function Remove-DarkBackground {
    param($bmp)
    $w = $bmp.Width
    $h = $bmp.Height
    $pts = @(
        [System.Drawing.Point]::new(0, 0),
        [System.Drawing.Point]::new($w - 1, 0),
        [System.Drawing.Point]::new(0, $h - 1),
        [System.Drawing.Point]::new($w - 1, $h - 1)
    )
    $rs = 0; $gs = 0; $bs = 0
    foreach ($p in $pts) {
        $c = $bmp.GetPixel($p.X, $p.Y)
        $rs += $c.R; $gs += $c.G; $bs += $c.B
    }
    $bgR = [int][Math]::Round($rs / $pts.Count)
    $bgG = [int][Math]::Round($gs / $pts.Count)
    $bgB = [int][Math]::Round($bs / $pts.Count)
    $tol = 40
    $soft = $tol + 30
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $c = $bmp.GetPixel($x, $y)
            $dr = $c.R - $bgR; $dg = $c.G - $bgG; $db = $c.B - $bgB
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
}

function Build-Logo {
    param([int]$OutW, [string]$Target)

    $src = [System.Drawing.Image]::FromFile($srcPath)
    $sw = $src.Width
    $sh = $src.Height
    $outH = [int][Math]::Round($OutW / 2.275)

    $out = New-Object System.Drawing.Bitmap($OutW, $outH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($out)
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $iconSrcSize = [int][Math]::Round($sw * 0.72)
    $iconSrcX = [int](($sw - $iconSrcSize) / 2)
    $iconSrcY = [int][Math]::Round($sh * 0.05)
    $iconDstH = [int][Math]::Round($outH * 0.9)
    $iconDstY = [int](($outH - $iconDstH) / 2)

    $g.DrawImage(
        $src,
        [System.Drawing.Rectangle]::new(0, $iconDstY, $iconDstH, $iconDstH),
        [System.Drawing.Rectangle]::new($iconSrcX, $iconSrcY, $iconSrcSize, $iconSrcSize),
        [System.Drawing.GraphicsUnit]::Pixel
    )

    $textSrcY = [int][Math]::Round($sh * 0.845)
    $textSrcH = [int][Math]::Round($sh * 0.095)
    $textDstX = $iconDstH + [int][Math]::Round($outH * 0.05)
    $textDstW = $OutW - $textDstX - 4
    $textDstH = [int][Math]::Round($outH * 0.26)
    $textDstY = [int](($outH - $textDstH) / 2)

    $g.DrawImage(
        $src,
        [System.Drawing.Rectangle]::new($textDstX, $textDstY, $textDstW, $textDstH),
        [System.Drawing.Rectangle]::new(0, $textSrcY, $sw, $textSrcH),
        [System.Drawing.GraphicsUnit]::Pixel
    )

    $g.Dispose()
    $src.Dispose()
    Remove-DarkBackground $out
    $tmp = "$Target.tmp.png"
    $out.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
    Move-Item -Path $tmp -Destination $Target -Force
    Write-Host "Gerado: $Target (${OutW}x${outH})"
}

Build-Logo -OutW 580 -Target $outPath
Build-Logo -OutW 870 -Target $out2xPath
