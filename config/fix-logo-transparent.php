<?php

$root = dirname(__DIR__);
$src = $root . '/assets/images/logo.2.png';
$bak = $root . '/assets/images/logo.2.bak.png';

if (!is_file($src)) {
    fwrite(STDERR, "Arquivo não encontrado: $src\n");
    exit(1);
}

if (!function_exists('imagecreatefrompng')) {
    fwrite(STDERR, "Extensão GD não disponível.\n");
    exit(1);
}

$img = @imagecreatefrompng($src);
if (!$img) {
    fwrite(STDERR, "Não foi possível abrir PNG.\n");
    exit(1);
}

imagealphablending($img, false);
imagesavealpha($img, true);

$w = imagesx($img);
$h = imagesy($img);

$pts = [
    [1, 1],
    [$w - 2, 1],
    [1, $h - 2],
    [$w - 2, $h - 2],
    [(int) ($w / 2), 1],
    [(int) ($w / 2), $h - 2],
];
$rs = $gs = $bs = 0;
$n = count($pts);
foreach ($pts as [$x, $y]) {
    $c = imagecolorat($img, $x, $y);
    $rs += ($c >> 16) & 0xFF;
    $gs += ($c >> 8) & 0xFF;
    $bs += $c & 0xFF;
}
$bgR = (int) round($rs / $n);
$bgG = (int) round($gs / $n);
$bgB = (int) round($bs / $n);

$tol = 42.0;
$soft = $tol + 24.0;

for ($y = 0; $y < $h; $y++) {
    for ($x = 0; $x < $w; $x++) {
        $c = imagecolorat($img, $x, $y);
        $a = ($c >> 24) & 0x7F;
        $r = ($c >> 16) & 0xFF;
        $g = ($c >> 8) & 0xFF;
        $b = $c & 0xFF;
        $d = sqrt(($r - $bgR) ** 2 + ($g - $bgG) ** 2 + ($b - $bgB) ** 2);
        if ($d <= $tol) {
            $col = imagecolorallocatealpha($img, $r, $g, $b, 127);
            imagesetpixel($img, $x, $y, $col);
        } elseif ($d < $soft) {
            $fade = (int) round(127 * (1 - ($d - $tol) / ($soft - $tol)));
            $fade = max(0, min(127, $fade));
            $col = imagecolorallocatealpha($img, $r, $g, $b, $fade);
            imagesetpixel($img, $x, $y, $col);
        }
    }
}

if (!is_file($bak)) {
    copy($src, $bak);
    echo "Backup: $bak\n";
}

imagepng($img, $src, 9);
imagedestroy($img);

echo "Background médio: rgb($bgR,$bgG,$bgB)\n";
echo "Salvo transparente: $src ({$w}x{$h})\n";
