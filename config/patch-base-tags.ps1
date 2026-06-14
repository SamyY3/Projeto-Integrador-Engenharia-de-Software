$root = Split-Path $PSScriptRoot -Parent
$old = '  <base href="../">'
$new = @'
  <base href="../" data-app-base>
  <script>(function(){var p=location.pathname.replace(/\\/g,"/"),b=document.querySelector("base[data-app-base]"),m=p.match(/^(.*\/)(?:auth|admin|pages|mapa)\/[^/]+$/);if(b)b.href=m?m[1]:p.replace(/\/[^/]*$/,"/")||"/";})();</script>
'@
$changed = @()
Get-ChildItem -Path $root -Recurse -Filter '*.html' | ForEach-Object {
    $c = [IO.File]::ReadAllText($_.FullName)
    if ($c.Contains($old) -and -not $c.Contains('data-app-base')) {
        $c = $c.Replace($old, $new)
        $c = $c.Replace('ecocoleta-paths.js?v=1', 'ecocoleta-paths.js?v=2')
        [IO.File]::WriteAllText($_.FullName, $c)
        $changed += $_.FullName.Substring($root.Length + 1)
    }
}
$changed | Set-Content (Join-Path $root '_base_update_changed.txt')
Write-Output ("Updated: " + $changed.Count)
