<?php

$root = dirname(__DIR__);
$srcPath = $root . '/assets/images/telas.png';
$outPath = $root . '/assets/images/logo.2.png';
$bakPath = $root . '/assets/images/logo.2.bak.png';

if (!function_exists('imagecreatefrompng')) {
    fwrite(STDERR, "GD nao disponivel.\n");
    exit(1);
}

if (!is_file($srcPath)) {
    fwrite(STDERR, "Fonte nao encontrada: $srcPath\n");
    exit(1);
}

$src = imagecreatefrompng($srcPath);
if (!$src) {
    fwrite(STDERR, "Nao foi possivel abrir telas.png\n");
    exit(1);
}

$sw = imagesx($src);
$sh = imagesy($src);

$outH = 252;
$outW = (int) round($outH * 2.275);

$out = imagecreatetruecolor($outW, $outH);
imagealphablending($out, false);
imagesavealpha($out, true);
$transparent = imagecolorallocatealpha($out, 0, 0, 0, 127);
imagefill($out, 0, 0, $transparent);
imagealphablending($out, true);

$iconSrcSize = (int) round($sw * 0.74);
$iconSrcX = (int) (($sw - $iconSrcSize) / 2);
$iconSrcY = (int) round($sh * 0.04);

$iconDstH = (int) round($outH * 0.9);
$iconDstW = $iconDstH;
$iconDstY = (int) (($outH - $iconDstH) / 2);

imagecopyresampled(
    $out,
    $src,
    0,
    $iconDstY,
    $iconSrcX,
    $iconSrcY,
    $iconDstW,
    $iconDstH,
    $iconSrcSize,
    $iconSrcSize
);

$textSrcY = (int) round($sh * 0.79);
$textSrcH = (int) round($sh * 0.16);
$textDstX = $iconDstW + (int) round($outW * 0.02);
$textDstW = $outW - $textDstX;
$textDstH = (int) round($outH * 0.34);
$textDstY = (int) (($outH - $textDstH) / 2);

imagecopyresampled(
    $out,
    $src,
    $textDstX,
    $textDstY,
    0,
    $textSrcY,
    $textDstW,
    $textDstH,
    $sw,
    $textSrcH
);

imagealphablending($out, false);
imagesavealpha($out, true);

$bgPts = [
    [0, 0],
    [$outW - 1, 0],
    [0, $outH - 1],
    [$outW - 1, $outH - 1],
];
$bgR = $bgG = $bgB = 0;
foreach ($bgPts as [$x, $y]) {
    $c = imagecolorat($out, $x, $y);
    $bgR += ($c >> 16) & 0xFF;
    $bgG += ($c >> 8) & 0xFF;
    $bgB += $c & 0xFF;
}
$bgR = (int) round($bgR / 4);
$bgG = (int) round($bgG / 4);
$bgB = (int) round($bgB / 4);

$tol = 38.0;
$soft = $tol + 28.0;

for ($y = 0; $y < $outH; $y++) {
    for ($x = 0; $x < $outW; $x++) {
        $c = imagecolorat($out, $x, $y);
        $r = ($c >> 16) & 0xFF;
        $g = ($c >> 8) & 0xFF;
        $b = $c & 0xFF;
        $d = sqrt(($r - $bgR) ** 2 + ($g - $bgG) ** 2 + ($b - $bgB) ** 2);
        if ($d <= $tol) {
            $col = imagecolorallocatealpha($out, $r, $g, $b, 127);
            imagesetpixel($out, $x, $y, $col);
        } elseif ($d < $soft) {
            $fade = (int) round(127 * (1 - ($d - $tol) / ($soft - $tol)));
            $fade = max(0, min(127, $fade));
            $col = imagecolorallocatealpha($out, $r, $g, $b, $fade);
            imagesetpixel($out, $x, $y, $col);
        }
    }
}

if (!is_file($bakPath) && is_file($outPath)) {
    copy($outPath, $bakPath);
}

imagepng($out, $outPath, 1);
imagedestroy($src);
imagedestroy($out);

$info = getimagesize($outPath);
echo "Gerado: $outPath ({$info[0]}x{$info[1]})\n";
