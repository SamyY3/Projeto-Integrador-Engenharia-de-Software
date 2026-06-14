<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$base = 'http://localhost/Ecocoleta';

$htmlFiles = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root));
foreach ($it as $file) {
    if (!$file->isFile() || $file->getExtension() !== 'html') {
        continue;
    }
    $path = str_replace('\\', '/', $file->getPathname());
    if (preg_match('#/(vendor|node_modules|ecocheck)/#', $path)) {
        continue;
    }
    $rel = substr($path, strlen(str_replace('\\', '/', $root)) + 1);
    $htmlFiles[] = $rel;
}
sort($htmlFiles);

$legacyNames = [
    'tela-inicia.html', 'perfil.html', 'login.html', 'cadastro.html', 'Ranking.html',
    'quem-somos.html', 'Home-ADM.html', 'Login-ADM-Ecoponto.html', 'relatorio.html',
    'pagina-relatorio.html', 'agendar-coleta.html', 'ecopontos.html',
];

function fetchUrl(string $url): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 8,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HEADER => true,
        CURLOPT_USERAGENT => 'EcoColeta-QA/1.0',
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $final = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    curl_close($ch);

    if ($raw === false) {
        return ['code' => 0, 'error' => $err, 'body' => '', 'final' => $final];
    }

    $headerSize = strpos($raw, "\r\n\r\n");
    $body = $headerSize !== false ? substr($raw, $headerSize + 4) : $raw;

    return ['code' => $code, 'error' => '', 'body' => $body, 'final' => $final];
}

$serverPing = fetchUrl($base . '/index.html');
$serverOk = $serverPing['code'] === 200;

$results = [];
$fail404 = [];
$failWhite = [];
$failOther = [];

foreach ($htmlFiles as $rel) {
    $url = $base . '/' . str_replace('\\', '/', $rel);
    if ($rel === 'index.html') {
        $url = $base . '/';
    }

    $r = fetchUrl($url);
    $body = $r['body'];
    $trim = trim(strip_tags($body));
    $hasHtml = stripos($body, '<html') !== false;
    $hasTitle = (bool) preg_match('/<title>[^<]+<\/title>/i', $body);
    $bodyLen = strlen($body);
    $visibleLen = strlen($trim);

    $issues = [];
    if ($r['code'] === 404) {
        $issues[] = 'HTTP 404';
    } elseif ($r['code'] === 0) {
        $issues[] = 'SEM RESPOSTA: ' . $r['error'];
    } elseif ($r['code'] !== 200) {
        $issues[] = 'HTTP ' . $r['code'];
    }
    if ($bodyLen < 80) {
        $issues[] = 'corpo muito curto (' . $bodyLen . ' bytes)';
    }
    if (!$hasHtml && $r['code'] === 200) {
        $issues[] = 'sem tag <html>';
    }
    if ($hasHtml && $visibleLen < 5 && !preg_match('/location\.replace|http-equiv=["\']refresh/i', $body)) {
        $issues[] = 'possivel tela branca (conteudo visivel minimo)';
    }

    $row = [
        'page' => $rel,
        'http' => $r['code'] ?: 'ERR',
        'final' => $r['final'],
        'bytes' => $bodyLen,
        'issues' => $issues,
    ];
    $results[] = $row;

    if ($r['code'] === 404) {
        $fail404[] = $rel;
    } elseif (!empty($issues)) {
        if (str_contains(implode(' ', $issues), 'branca') || str_contains(implode(' ', $issues), 'curto')) {
            $failWhite[] = $rel;
        } else {
            $failOther[] = $rel;
        }
    }
}

$legacyResults = [];
foreach ($legacyNames as $name) {
    $r = fetchUrl($base . '/' . $name);
    $legacyResults[] = [
        'url' => '/' . $name,
        'http' => $r['code'] ?: 'ERR',
        'final' => $r['final'],
        'ok' => $r['code'] === 200,
    ];
}

$apis = [
    'api/ecocheck-api.php?action=status',
    'api/meu_perfil.php',
    'api/ranking.php',
    'auth/login.php',
];
$apiResults = [];
foreach ($apis as $ep) {
    $r = fetchUrl($base . '/' . $ep);
    $apiResults[] = ['ep' => $ep, 'http' => $r['code'] ?: 'ERR'];
}

header('Content-Type: text/plain; charset=utf-8');
echo "=== VISTORIA EcoColeta ===\n";
echo 'Data: ' . date('Y-m-d H:i:s') . "\n";
echo 'Servidor: ' . ($serverOk ? 'ONLINE' : 'OFFLINE') . "\n";
echo 'Paginas HTML: ' . count($htmlFiles) . "\n\n";

$okCount = count(array_filter($results, fn($x) => empty($x['issues'])));
echo "RESUMO\n";
echo "- OK (sem problemas): $okCount / " . count($results) . "\n";
echo "- 404: " . count($fail404) . "\n";
echo "- Tela branca / corpo vazio: " . count($failWhite) . "\n";
echo "- Outros problemas: " . count($failOther) . "\n\n";

if ($fail404) {
    echo "=== 404 ===\n";
    foreach ($fail404 as $p) {
        echo "  - $p\n";
    }
    echo "\n";
}

if ($failWhite) {
    echo "=== TELA BRANCA / CONTEUDO VAZIO ===\n";
    foreach ($results as $row) {
        if (!in_array($row['page'], $failWhite, true)) {
            continue;
        }
        echo "  - {$row['page']} (HTTP {$row['http']}, {$row['bytes']} bytes)\n";
        foreach ($row['issues'] as $i) {
            echo "      * $i\n";
        }
    }
    echo "\n";
}

if ($failOther) {
    echo "=== OUTROS PROBLEMAS ===\n";
    foreach ($results as $row) {
        if (!in_array($row['page'], $failOther, true)) {
            continue;
        }
        echo "  - {$row['page']}: " . implode('; ', $row['issues']) . "\n";
    }
    echo "\n";
}

echo "=== URLs LEGADAS (.htaccess) ===\n";
foreach ($legacyResults as $lr) {
    $status = $lr['ok'] ? 'OK' : 'FALHA';
    echo "  [$status] {$lr['url']} -> HTTP {$lr['http']}\n";
    if ($lr['final'] && $lr['final'] !== $base . $lr['url']) {
        echo "         final: {$lr['final']}\n";
    }
}
echo "\n";

echo "=== APIs (amostra) ===\n";
foreach ($apiResults as $ar) {
    echo "  {$ar['ep']}: HTTP {$ar['http']}\n";
}
echo "\n";

echo "=== TODAS AS PAGINAS ===\n";
foreach ($results as $row) {
    $flag = empty($row['issues']) ? 'OK' : '!!';
    echo sprintf("[%s] %-40s HTTP %-4s %6d bytes\n", $flag, $row['page'], (string) $row['http'], $row['bytes']);
}
