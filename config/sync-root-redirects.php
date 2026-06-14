<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$log = [];

function redirect_stub(string $target, string $title): string
{
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $safeTarget = htmlspecialchars($target, ENT_QUOTES, 'UTF-8');
    return <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url={$safeTarget}">
  <title>{$safeTitle} | EcoColeta</title>
  <script>location.replace("{$safeTarget}" + location.search + location.hash);</script>
</head>
<body>
  <p><a href="{$safeTarget}">Abrir {$safeTitle}</a></p>
</body>
</html>

HTML;
}

$pageAliases = [
    'relatorio.html' => 'pages/pagina-relatorio.html',
];

$folders = ['auth', 'admin', 'pages'];
$redirects = [];

foreach ($folders as $folder) {
    $dir = $root . DIRECTORY_SEPARATOR . $folder;
    if (!is_dir($dir)) {
        continue;
    }
    foreach (scandir($dir) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..' || !str_ends_with(strtolower($entry), '.html')) {
            continue;
        }
        $redirects[$entry] = $folder . '/' . $entry;
    }
}

foreach ($pageAliases as $alias => $target) {
    $redirects[$alias] = $target;
}

$created = 0;
$updated = 0;
$skipped = 0;

foreach ($redirects as $name => $target) {
    if ($name === 'index.html') {
        continue;
    }
    $path = $root . DIRECTORY_SEPARATOR . $name;
    $title = preg_replace('/\.html$/i', '', $name);
    $title = str_replace(['-', '_'], ' ', $title);
    $content = redirect_stub($target, $title);

    if (!is_file($path)) {
        file_put_contents($path, $content);
        $log[] = "CRIADO: $name -> $target";
        $created++;
        continue;
    }

    $existing = file_get_contents($path);
    if ($existing === false) {
        continue;
    }
    $hasRedirect = str_contains($existing, 'location.replace') && str_contains($existing, $target);
    $hasViewport = str_contains($existing, 'name="viewport"');
    if ($hasRedirect && $hasViewport) {
        $skipped++;
        continue;
    }
    file_put_contents($path, $content);
    $log[] = "ATUALIZADO: $name -> $target";
    $updated++;
}

echo "=== sync-root-redirects ===\n";
echo "Criados: $created | Atualizados: $updated | Ignorados: $skipped\n\n";
echo implode("\n", $log) . "\n";
