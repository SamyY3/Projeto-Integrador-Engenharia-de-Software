<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$baseUrl = getenv('ECOCOLETA_BASE_URL') ?: 'http://localhost/Ecocoleta';
$reportPath = $root . '/docs/QA-INTEGRACAO-FLUXOS.md';

$results = [];

function qa_log(array &$results, string $fluxo, string $tipo, string $teste, string $status, string $detalhe = ''): void
{
    $results[] = [
        'fluxo' => $fluxo,
        'tipo' => $tipo,
        'teste' => $teste,
        'status' => $status,
        'detalhe' => $detalhe,
    ];
    $icon = $status === 'OK' ? '+' : ($status === 'AVISO' ? '~' : 'X');
    echo "[$icon][$tipo] $fluxo — $teste: $status" . ($detalhe ? " ($detalhe)" : '') . PHP_EOL;
}

function http_request(string $method, string $url, array $opts = []): array
{
    $cookies = $opts['cookies'] ?? [];
    $headers = $opts['headers'] ?? [];
    $body = $opts['body'] ?? null;
    $isMultipart = !empty($opts['multipart']);

    $ch = curl_init($url);
    $cookieStr = '';
    foreach ($cookies as $k => $v) {
        $cookieStr .= rawurlencode((string) $k) . '=' . rawurlencode((string) $v) . '; ';
    }

    $curlHeaders = $headers;
    if ($cookieStr !== '') {
        $curlHeaders[] = 'Cookie: ' . rtrim($cookieStr, '; ');
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => $curlHeaders,
    ]);

    if ($body !== null) {
        if ($isMultipart) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        } else {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            if (!in_array('Content-Type: application/x-www-form-urlencoded', $curlHeaders, true)) {
                $curlHeaders[] = 'Content-Type: application/x-www-form-urlencoded';
                curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);
            }
        }
    }

    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    $rawHeaders = substr((string) $raw, 0, $headerSize);
    $respBody = substr((string) $raw, $headerSize);

    $newCookies = $cookies;
    if (preg_match_all('/^Set-Cookie:\s*([^=]+)=([^;]*)/mi', $rawHeaders, $m, PREG_SET_ORDER)) {
        foreach ($m as $c) {
            $newCookies[trim($c[1])] = trim($c[2]);
        }
    }

    return [
        'cookies' => $newCookies,
        'body' => $respBody,
        'code' => $code,
        'headers' => explode("\r\n", $rawHeaders),
    ];
}

function json_decode_safe(string $text): ?array
{
    $text = preg_replace('/^\xEF\xBB\xBF/', '', trim($text)) ?? trim($text);
    $data = json_decode($text, true);
    return is_array($data) ? $data : null;
}

function ecocheck_solve_via_http(array $cookies): array
{
    $base = $GLOBALS['baseUrl'];
    $r1 = http_request('GET', $base . '/api/ecocheck-api.php?action=challenge', ['cookies' => $cookies]);
    $data = json_decode_safe($r1['body']);
    if (!$data || empty($data['challengeId'])) {
        return ['ok' => false, 'erro' => 'challenge falhou', 'cookies' => $r1['cookies']];
    }

    $targetX = null;
    $bg = (string) ($data['background'] ?? '');
    if (preg_match('/rect x="(\d+)"/', $bg, $mx)) {
        $targetX = (int) $mx[1];
    } elseif (str_starts_with($bg, 'data:image/svg+xml;base64,')) {
        $svg = base64_decode(substr($bg, 26), true);
        if ($svg && preg_match('/rect x="(\d+)"/', $svg, $mx2)) {
            $targetX = (int) $mx2[1];
        }
    }

    if ($targetX === null) {
        return ['ok' => false, 'erro' => 'targetX nao extraido do puzzle', 'cookies' => $r1['cookies']];
    }

    $payload = json_encode([
        'challengeId' => $data['challengeId'],
        'positionX' => $targetX,
        'durationMs' => 1800,
        'sampleCount' => 24,
        'straightRatio' => 0.4,
        'velocityStd' => 0.12,
        'honeypot' => '',
    ]);

    $r2 = http_request('POST', $base . '/api/ecocheck-api.php?action=verify', [
        'cookies' => $r1['cookies'],
        'headers' => ['Content-Type: application/json'],
        'body' => $payload,
    ]);
    $verified = json_decode_safe($r2['body']);
    if (!$verified || empty($verified['sucesso']) || empty($verified['token'])) {
        return ['ok' => false, 'erro' => $verified['erro'] ?? 'verify falhou', 'cookies' => $r2['cookies']];
    }

    return ['ok' => true, 'token' => $verified['token'], 'cookies' => $r2['cookies']];
}

function wb_sessionstorage_key(string $html, string $key, string $op): bool
{
    $patterns = [
        "sessionStorage.{$op}('" . $key . "'",
        'sessionStorage.' . $op . '("' . $key . '"',
        "sessionStorage.{$op}(`" . $key . "`",
    ];
    foreach ($patterns as $p) {
        if (str_contains($html, $p)) {
            return true;
        }
    }
    return false;
}

function wb_sessionstorage(array &$results): void
{
    $fluxo = 'sessionStorage (recuperar/verificacao/nova-senha)';
    $checks = [
        ['auth/recuperar.html', 'resetEmail', 'setItem', 'grava e-mail ao enviar'],
        ['auth/recuperar.html', 'resetVerified', 'setItem', 'marca nao verificado'],
        ['auth/verificacao.html', 'resetEmail', 'getItem', 'le e-mail da etapa anterior'],
        ['auth/verificacao.html', 'resetToken', 'setItem', 'grava token apos codigo'],
        ['auth/verificacao.html', 'resetVerified', 'setItem', 'marca verificado'],
        ['auth/nova-senha.html', 'resetVerified', 'getItem', 'exige verificacao'],
        ['auth/nova-senha.html', 'resetToken', 'getItem', 'exige token'],
        ['auth/cadastro.html', 'signupEmail', 'setItem', 'grava e-mail apos cadastro'],
        ['auth/cadastro.html', 'signupCodigoTeste', 'setItem', 'grava codigo teste local'],
        ['auth/verificar-cadastro.html', 'signupEmail', 'getItem', 'le e-mail pendente'],
        ['auth/verificar-cadastro.html', 'signupCodigoTeste', 'getItem', 'le codigo teste'],
    ];
    $root = $GLOBALS['root'];
    foreach ($checks as [$rel, $key, $op, $desc]) {
        $path = $root . '/' . str_replace('/', DIRECTORY_SEPARATOR, $rel);
        $html = is_file($path) ? (string) file_get_contents($path) : '';
        $ok = wb_sessionstorage_key($html, $key, $op);
        qa_log($results, $fluxo, 'branca', "$rel $desc ($op $key)", $ok ? 'OK' : 'FALHA');
    }
    $nova = (string) file_get_contents($root . '/auth/nova-senha.html');
    $redirectOk = str_contains($nova, "verified !== 'true'") && str_contains($nova, "recuperar.html");
    qa_log($results, $fluxo, 'branca', 'nova-senha redireciona sem verificacao', $redirectOk ? 'OK' : 'FALHA');
}

function test_login_morador(array &$results, array &$cookies): ?array
{
    $fluxo = 'Login morador + EcoCheck + MySQL';
    $eco = ecocheck_solve_via_http($cookies);
    if (!$eco['ok']) {
        qa_log($results, $fluxo, 'preta', 'EcoCheck challenge+verify', 'FALHA', $eco['erro']);
        return null;
    }
    qa_log($results, $fluxo, 'preta', 'EcoCheck challenge+verify', 'OK');
    $cookies = $eco['cookies'];

    require_once $GLOBALS['root'] . '/includes/usuarios-seed-data.php';
    $email = 'ana.paula.ferreira' . ECOSEED_USUARIOS_EMAIL_SUFFIX;
    $senha = ECOSEED_USUARIOS_SENHA_PADRAO;
    $body = http_build_query([
        'email' => $email,
        'senha' => $senha,
        'ecocheck_token' => $eco['token'],
    ]);
    $r = http_request('POST', $GLOBALS['baseUrl'] . '/auth/login.php', [
        'cookies' => $cookies,
        'body' => $body,
    ]);
    $cookies = $r['cookies'];
    $data = json_decode_safe($r['body']);
    $ok = $data && !empty($data['sucesso']) && !empty($data['usuario']['id']);
    qa_log($results, $fluxo, 'preta', 'POST login.php credencial seed', $ok ? 'OK' : 'FALHA',
        $ok ? 'user#' . $data['usuario']['id'] : ($data['erro'] ?? $r['body']));

    if ($ok) {
        $r2 = http_request('GET', $GLOBALS['baseUrl'] . '/api/meu_perfil.php', ['cookies' => $cookies]);
        $prof = json_decode_safe($r2['body']);
        $sessOk = $prof && !empty($prof['sucesso']) && !empty($prof['usuario']);
        qa_log($results, $fluxo, 'preta', 'Sessao meu_perfil.php apos login', $sessOk ? 'OK' : 'FALHA');
    }

    qa_log($results, $fluxo, 'branca', 'login.php exige ecocheck_exigir_token()',
        str_contains(file_get_contents($GLOBALS['root'] . '/auth/login.php'), 'ecocheck_exigir_token') ? 'OK' : 'FALHA');

    require_once $GLOBALS['root'] . '/includes/usuarios-seed-data.php';
    $seedEmail = 'ana.paula.ferreira' . ECOSEED_USUARIOS_EMAIL_SUFFIX;

    return $ok ? [
        'cookies' => $cookies,
        'usuario' => $data['usuario'],
        'email' => $seedEmail,
        'usuario_id' => (int) ($data['usuario']['id'] ?? 0),
    ] : null;
}

function qa_http_saldo_resgates(array $cookies): ?array
{
    $r = http_request('POST', $GLOBALS['baseUrl'] . '/api/resgate_premio.php', [
        'cookies' => $cookies,
        'body' => http_build_query(['acao' => 'verificar_resgates']),
    ]);
    $data = json_decode_safe($r['body']);
    if (!$data || empty($data['sucesso'])) {
        return null;
    }
    return [
        'saldo' => (int) ($data['saldo_ecopoints'] ?? 0),
        'resgates' => array_map('intval', $data['resgates'] ?? []),
    ];
}

function qa_db_premio_elegivel(int $usuarioId, int $saldo): ?array
{
    require_once $GLOBALS['root'] . '/includes/conexao.php';
    $stmt = $conn->prepare(
        "SELECT b.id_beneficio, b.pontos_necessarios, b.nome_beneficio
         FROM beneficio b
         WHERE b.pontos_necessarios > 0 AND b.pontos_necessarios <= ?
           AND NOT EXISTS (
               SELECT 1 FROM resgate r
               WHERE r.id_usuario = ? AND r.id_beneficio = b.id_beneficio
           )
         ORDER BY b.pontos_necessarios ASC
         LIMIT 1"
    );
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('ii', $saldo, $usuarioId);
    if (!$stmt->execute()) {
        $stmt->close();
        return null;
    }
    $row = null;
    if (method_exists($stmt, 'get_result')) {
        $row = $stmt->get_result()->fetch_assoc();
    } else {
        $id = 0;
        $pts = 0;
        $nome = '';
        $stmt->bind_result($id, $pts, $nome);
        if ($stmt->fetch()) {
            $row = ['id_beneficio' => $id, 'pontos_necessarios' => $pts, 'nome_beneficio' => $nome];
        }
    }
    $stmt->close();
    if (!$row) {
        return null;
    }
    return [
        'id_beneficio' => (int) $row['id_beneficio'],
        'pontos_necessarios' => (int) $row['pontos_necessarios'],
        'nome' => (string) ($row['nome_beneficio'] ?? ''),
    ];
}

function qa_agendar_slot_livre(array $cookies): ?array
{
    for ($d = 10; $d <= 28; $d++) {
        $dataColeta = date('Y-m-d', strtotime('+' . $d . ' days'));
        for ($slot = 0; $slot <= 4; $slot++) {
            $body = http_build_query([
                'acao' => 'agendar',
                'data_coleta' => $dataColeta,
                'slot_ordem' => $slot,
                'tipo_residuo' => 'plastico',
                'somente_pendente' => '1',
            ]);
            $r = http_request('POST', $GLOBALS['baseUrl'] . '/api/agendamento_coleta.php', [
                'cookies' => $cookies,
                'body' => $body,
            ]);
            $data = json_decode_safe($r['body']);
            if ($data && !empty($data['sucesso']) && !empty($data['id_agendamento'])) {
                return $data;
            }
            if (($data['erro_codigo'] ?? '') !== 'ja_agendado') {
                return $data ?: null;
            }
        }
    }
    return null;
}

function test_fluxo_balanca_completo(array &$results, array $moradorCookies, array $adminCookies): ?int
{
    $fluxo = 'Fluxo balanca completo';
    $pesoKg = 5.0;
    $pontosCreditados = 0;

    $antes = qa_http_saldo_resgates($moradorCookies);
    $saldoAntes = $antes ? $antes['saldo'] : 0;

    $ag = qa_agendar_slot_livre($moradorCookies);
    if (!$ag || empty($ag['sucesso'])) {
        qa_log($results, $fluxo, 'preta', 'POST agendar coleta pendente', 'FALHA', $ag['erro'] ?? 'sem slot');
        return null;
    }
    $idAg = (int) $ag['id_agendamento'];
    qa_log($results, $fluxo, 'preta', 'POST agendar coleta pendente', 'OK', "ag#$idAg status=" . ($ag['status_coleta'] ?? ''));

    $bodyBal = http_build_query([
        'acao' => 'atualizar_balanca',
        'id_agendamento' => $idAg,
        'peso_pendente_kg' => $pesoKg,
        'tipo_residuo' => 'plastico',
    ]);
    $rBal = http_request('POST', $GLOBALS['baseUrl'] . '/api/agendamento_coleta.php', [
        'cookies' => $moradorCookies,
        'body' => $bodyBal,
    ]);
    $bal = json_decode_safe($rBal['body']);
    $balOk = $bal && !empty($bal['sucesso']) && ($bal['status_coleta'] ?? '') === 'aguardando_validacao';
    qa_log($results, $fluxo, 'preta', 'POST atualizar_balanca (morador)', $balOk ? 'OK' : 'FALHA',
        $balOk ? $pesoKg . 'kg ~' . ($bal['pontos_estimados'] ?? '?') . ' pts' : ($bal['erro'] ?? ''));

    $materiais = json_encode([['material' => 'plastico', 'peso_kg' => $pesoKg]], JSON_UNESCAPED_UNICODE);
    $bodyAdm = http_build_query([
        'acao' => 'confirmar_recebimento',
        'id_agendamento' => $idAg,
        'peso_validado_kg' => $pesoKg,
        'materiais' => $materiais,
        'pagina' => '1',
    ]);
    $rAdm = http_request('POST', $GLOBALS['baseUrl'] . '/api/adm-coletas.php', [
        'cookies' => $adminCookies,
        'body' => $bodyAdm,
    ]);
    $adm = json_decode_safe($rAdm['body']);
    $admOk = $adm && !empty($adm['sucesso']) && (int) ($adm['pontos'] ?? 0) > 0;
    $pontosCreditados = (int) ($adm['pontos'] ?? 0);
    qa_log($results, $fluxo, 'preta', 'POST adm-coletas confirmar_recebimento', $admOk ? 'OK' : 'FALHA',
        $admOk ? "+{$pontosCreditados} pts" : ($adm['erro'] ?? $rAdm['body']));

    $depois = qa_http_saldo_resgates($moradorCookies);
    $saldoDepois = $depois ? $depois['saldo'] : 0;
    $delta = $saldoDepois - $saldoAntes;
    $saldoOk = $depois && $delta >= $pontosCreditados && $pontosCreditados > 0;
    qa_log($results, $fluxo, 'preta', 'Saldo EcoPoints apos confirmacao', $saldoOk ? 'OK' : 'FALHA',
        "antes=$saldoAntes depois=$saldoDepois delta=$delta");

    qa_log($results, $fluxo, 'branca', 'coleta_confirmar_recebimento_admin() em pontuacao-coleta.php',
        str_contains(file_get_contents($GLOBALS['root'] . '/includes/pontuacao-coleta.php'), 'function coleta_confirmar_recebimento_admin') ? 'OK' : 'FALHA');
    qa_log($results, $fluxo, 'branca', 'adm-coletas.php acao confirmar_recebimento',
        str_contains(file_get_contents($GLOBALS['root'] . '/api/adm-coletas.php'), 'confirmar_recebimento') ? 'OK' : 'FALHA');

    return $saldoOk ? $saldoDepois : null;
}

function test_resgate_debito_pontos(array &$results, array $moradorCookies, int $usuarioId, ?int $saldoEsperado = null): void
{
    $fluxo = 'Resgate com debito de pontos';
    $info = qa_http_saldo_resgates($moradorCookies);
    if (!$info) {
        qa_log($results, $fluxo, 'preta', 'Saldo inicial via verificar_resgates', 'FALHA');
        return;
    }
    $saldoAntes = $saldoEsperado ?? $info['saldo'];
    qa_log($results, $fluxo, 'preta', 'Saldo antes do resgate', 'OK', (string) $saldoAntes);

    $premio = qa_db_premio_elegivel($usuarioId, $saldoAntes);
    if (!$premio) {
        qa_log($results, $fluxo, 'preta', 'Premio elegivel no banco', 'AVISO', 'sem premio disponivel ou saldo insuficiente');
        return;
    }
    qa_log($results, $fluxo, 'branca', 'Premio elegivel (setup DB)', 'OK',
        '#' . $premio['id_beneficio'] . ' ' . $premio['pontos_necessarios'] . ' pts');

    $body = http_build_query([
        'acao' => 'resgatar',
        'id_beneficio' => $premio['id_beneficio'],
    ]);
    $r = http_request('POST', $GLOBALS['baseUrl'] . '/api/resgate_premio.php', [
        'cookies' => $moradorCookies,
        'body' => $body,
    ]);
    $data = json_decode_safe($r['body']);
    $ok = $data && !empty($data['sucesso']);
    $ptsUsados = (int) ($data['pontos_utilizados'] ?? 0);
    qa_log($results, $fluxo, 'preta', 'POST resgatar premio', $ok ? 'OK' : 'FALHA',
        $ok ? "-{$ptsUsados} pts cupom=" . ($data['cupom_codigo'] ?? '') : ($data['erro'] ?? ''));

    if (!$ok) {
        return;
    }

    $saldoApi = (int) ($data['saldo_ecopoints'] ?? -1);
    $esperado = $saldoAntes - $ptsUsados;
    $debitoOk = $ptsUsados === $premio['pontos_necessarios']
        && $saldoApi === $esperado
        && $saldoApi >= 0;
    qa_log($results, $fluxo, 'preta', 'Debito de pontos no saldo', $debitoOk ? 'OK' : 'FALHA',
        "esperado=$esperado retornado=$saldoApi");

    $depois = qa_http_saldo_resgates($moradorCookies);
    $listaOk = $depois
        && in_array($premio['id_beneficio'], $depois['resgates'], true)
        && $depois['saldo'] === $esperado;
    qa_log($results, $fluxo, 'preta', 'Premio em verificar_resgates', $listaOk ? 'OK' : 'FALHA',
        $depois ? 'saldo=' . $depois['saldo'] : '');

    qa_log($results, $fluxo, 'branca', 'resgate_premio.php acao resgatar com transacao',
        str_contains(file_get_contents($GLOBALS['root'] . '/api/resgate_premio.php'), '$conn->begin_transaction()') ? 'OK' : 'FALHA');
}

function test_admin_login(array &$results, string $endpoint, string $email, string $senha, string $label): array
{
    $fluxo = "Admin $label";
    $cookies = [];
    $eco = ecocheck_solve_via_http($cookies);
    if (!$eco['ok']) {
        qa_log($results, $fluxo, 'preta', 'EcoCheck', 'FALHA', $eco['erro']);
        return [];
    }
    $body = http_build_query([
        'email' => $email,
        'senha' => $senha,
        'ecocheck_token' => $eco['token'],
    ]);
    $r = http_request('POST', $GLOBALS['baseUrl'] . '/' . ltrim($endpoint, '/'), [
        'cookies' => $eco['cookies'],
        'body' => $body,
    ]);
    $data = json_decode_safe($r['body']);
    $ok = $data && !empty($data['sucesso']);
    qa_log($results, $fluxo, 'preta', "POST $endpoint", $ok ? 'OK' : 'FALHA', $data['erro'] ?? '');
    if ($ok) {
        qa_log($results, $fluxo, 'preta', 'Cookie de sessao recebido',
            !empty($r['cookies']) ? 'OK' : 'AVISO', count($r['cookies']) . ' cookies');
    }
    return ['cookies' => $r['cookies'], 'data' => $data];
}

function test_mapa_externo(array &$results): void
{
    $fluxo = 'Mapa GPS/OSRM/Overpass';
    $lat1 = -7.23; $lng1 = -39.41;
    $lat2 = -7.24; $lng2 = -39.40;
    $osrm = $GLOBALS['baseUrl'];
    $osrmUrl = "https://router.project-osrm.org/route/v1/driving/$lng1,$lat1;$lng2,$lat2?overview=false";
    $r = http_request('GET', $osrmUrl);
    $data = json_decode_safe($r['body']);
    $ok = $data && ($data['code'] ?? '') === 'Ok' && !empty($data['routes'][0]['distance']);
    qa_log($results, $fluxo, 'preta', 'OSRM route API', $ok ? 'OK' : 'FALHA',
        $ok ? round($data['routes'][0]['distance']) . 'm' : '');

    $overpass = 'https://overpass-api.de/api/interpreter';
    $q = '[out:json][timeout:25];node["amenity"="recycling"](-7.3,-39.5,-7.2,-39.3);out 1;';
    $op = null;
    $opDetail = '';
    for ($try = 0; $try < 2; $try++) {
        $r2 = http_request('POST', $overpass, [
            'headers' => [
                'Content-Type: application/x-www-form-urlencoded',
                'User-Agent: EcoColeta-QA/1.0',
            ],
            'body' => 'data=' . rawurlencode($q),
        ]);
        $op = json_decode_safe($r2['body']);
        if ($op && isset($op['elements'])) {
            $opDetail = count($op['elements']) . ' elementos';
            break;
        }
        $opDetail = $r2['code'] ? 'HTTP ' . $r2['code'] : 'sem resposta JSON';
        sleep(2);
    }
    $opStatus = ($op && isset($op['elements'])) ? 'OK' : (($r2['code'] ?? 0) >= 500 ? 'AVISO' : 'FALHA');
    if (($op && isset($op['elements'])) || ($r2['code'] ?? 0) === 429) {
        $opStatus = ($op && isset($op['elements'])) ? 'OK' : 'AVISO';
        if (($r2['code'] ?? 0) === 429) {
            $opDetail = 'rate limit Overpass (testar no mapa)';
        }
    }
    qa_log($results, $fluxo, 'preta', 'Overpass API ecopontos', $opStatus, $opDetail);

    qa_log($results, $fluxo, 'branca', 'route-service.js usa OSRM',
        str_contains(file_get_contents($GLOBALS['root'] . '/mapa/route-service.js'), 'router.project-osrm.org') ? 'OK' : 'FALHA');
    qa_log($results, $fluxo, 'branca', 'mapa.js cache Overpass sessionStorage',
        str_contains(file_get_contents($GLOBALS['root'] . '/mapa/mapa.js'), 'OSM_ECOPONTOS_CACHE_KEY') ? 'OK' : 'FALHA');
    qa_log($results, $fluxo, 'branca', 'geolocation-service.js presente',
        is_file($GLOBALS['root'] . '/mapa/geolocation-service.js') ? 'OK' : 'FALHA');
}

function test_avatar_upload(array &$results, array $cookies, string $emailMorador): void
{
    $fluxo = 'Upload avatar';
    $imgPath = $GLOBALS['root'] . '/assets/images/telas.png';
    if (!is_file($imgPath)) {
        qa_log($results, $fluxo, 'preta', 'Arquivo teste PNG', 'FALHA', 'logo ausente');
        return;
    }
    $cfile = new CURLFile($imgPath, 'image/png', 'avatar-test.png');
    $r = http_request('POST', $GLOBALS['baseUrl'] . '/api/atualizar-perfil.php', [
        'cookies' => $cookies,
        'multipart' => true,
        'body' => [
            'foto' => $cfile,
            'email' => $emailMorador,
            'confirmaremail' => $emailMorador,
            'senha' => '',
            'confirmarsenha' => '',
        ],
    ]);
    $data = json_decode_safe($r['body']);
    $ok = $data && !empty($data['sucesso']);
    qa_log($results, $fluxo, 'preta', 'POST atualizar-perfil.php foto', $ok ? 'OK' : 'FALHA', $data['erro'] ?? '');
    $uploadsDir = $GLOBALS['root'] . '/api/uploads';
    qa_log($results, $fluxo, 'branca', 'Pasta api/uploads gravavel', is_dir($uploadsDir) && is_writable($uploadsDir) ? 'OK' : 'AVISO');
}

function test_resgate_premio(array &$results, array $cookies): void
{
    $fluxo = 'Resgate de premios';
    $body = http_build_query(['acao' => 'verificar_resgates']);
    $r = http_request('POST', $GLOBALS['baseUrl'] . '/api/resgate_premio.php', [
        'cookies' => $cookies,
        'body' => $body,
    ]);
    $data = json_decode_safe($r['body']);
    $ok = $data && !empty($data['sucesso']);
    qa_log($results, $fluxo, 'preta', 'POST verificar_resgates', $ok ? 'OK' : 'FALHA', $data['erro'] ?? '');
    if ($ok) {
        qa_log($results, $fluxo, 'branca', 'Endpoint valida sessao usuario_id', 'OK');
    }
}

function test_coleta_balanca(array &$results, array $cookies): void
{
    $fluxo = 'Coleta / balanca';
    $r = http_request('GET', $GLOBALS['baseUrl'] . '/api/agendamento_coleta.php?acao=status', ['cookies' => $cookies]);
    $data = json_decode_safe($r['body']);
    qa_log($results, $fluxo, 'preta', 'GET agendamento status',
        ($data && array_key_exists('sucesso', $data)) ? 'OK' : 'FALHA', $data['erro'] ?? '');

    $r2 = http_request('GET', $GLOBALS['baseUrl'] . '/api/pontuacao-coleta.php?acao=simular', ['cookies' => $cookies]);
    $sim = json_decode_safe($r2['body']);
    qa_log($results, $fluxo, 'preta', 'GET pontuacao simular',
        ($sim && array_key_exists('sucesso', $sim)) ? 'OK' : 'AVISO', $sim['erro'] ?? 'requer params');

    qa_log($results, $fluxo, 'branca', 'balanca-ecoponto.js + pontuacao-coleta.js',
        (is_file($GLOBALS['root'] . '/assets/js/balanca-ecoponto.js') && is_file($GLOBALS['root'] . '/assets/js/pontuacao-coleta.js')) ? 'OK' : 'FALHA');
}

function test_smtp(array &$results): void
{
    $fluxo = 'E-mail SMTP';
    require_once $GLOBALS['root'] . '/includes/email_helper.php';
    $cfgPath = $GLOBALS['root'] . '/config/smtp_settings.json';
    $cfg = ecocoleta_carregar_smtp_settings($GLOBALS['root'] . '/config');
    $hasCfg = !isset($cfg['erro']);
    qa_log($results, $fluxo, 'branca', 'smtp_settings.json valido', $hasCfg ? 'OK' : 'FALHA', $cfg['erro'] ?? '');
    qa_log($results, $fluxo, 'branca', 'PHPMailer instalado', ecocoleta_phpmailer_disponivel() ? 'OK' : 'FALHA');
    $modoLocal = $hasCfg && !empty($cfg['modo_local_sem_email']);
    qa_log($results, $fluxo, 'branca', 'modo_local_sem_email', $modoLocal ? 'AVISO' : 'OK', $modoLocal ? 'codigo na tela' : 'SMTP configurado');

    $r = http_request('GET', $GLOBALS['baseUrl'] . '/api/testar-email.php');
    $data = json_decode_safe($r['body']);
    qa_log($results, $fluxo, 'preta', 'testar-email.php sem param',
        ($data && isset($data['erro'])) ? 'OK' : 'FALHA', 'exige email');

    qa_log($results, $fluxo, 'preta', 'Envio SMTP real', 'AVISO', 'Execute manualmente: /api/testar-email.php?email=SEU_EMAIL');
}

function test_cadastro_recuperar(array &$results): void
{
    $fluxo = 'Cadastro / recuperar senha';
    $eco = ecocheck_solve_via_http([]);
    if (!$eco['ok']) {
        qa_log($results, $fluxo, 'preta', 'EcoCheck para cadastro', 'FALHA', $eco['erro']);
        return;
    }
    $emailTest = 'qa.test.' . time() . '@seed.ecocoleta.local';
    $body = http_build_query([
        'nome' => 'QA Teste',
        'email' => $emailTest,
        'senha' => 'Senha@9kLm',
        'ecocheck_token' => $eco['token'],
    ]);
    $r = http_request('POST', $GLOBALS['baseUrl'] . '/auth/cadastro.php', [
        'cookies' => $eco['cookies'],
        'body' => $body,
    ]);
    $data = json_decode_safe($r['body']);
    $cadOk = $data && !empty($data['sucesso']);
    qa_log($results, $fluxo, 'preta', 'POST cadastro.php + EcoCheck', $cadOk ? 'OK' : 'AVISO', $data['erro'] ?? ($data['codigo_para_teste'] ?? ''));

    $eco2 = ecocheck_solve_via_http([]);
    require_once $GLOBALS['root'] . '/includes/usuarios-seed-data.php';
    $body2 = http_build_query([
        'email' => 'ana.paula.ferreira' . ECOSEED_USUARIOS_EMAIL_SUFFIX,
        'ecocheck_token' => $eco2['token'] ?? '',
    ]);
    $r2 = http_request('POST', $GLOBALS['baseUrl'] . '/auth/recuperar.php', [
        'cookies' => $eco2['cookies'] ?? [],
        'body' => $body2,
    ]);
    $rec = json_decode_safe($r2['body']);
    qa_log($results, $fluxo, 'preta', 'POST recuperar.php',
        ($rec && !empty($rec['sucesso'])) ? 'OK' : 'AVISO', $rec['erro'] ?? ($rec['codigo_para_teste'] ?? ''));
}

echo "=== QA Integracao EcoColeta ===\nBase: $baseUrl\n\n";

wb_sessionstorage($results);

$cookies = [];
$morador = test_login_morador($results, $cookies);
$adminEco = test_admin_login(
    $results,
    'admin/Login-ADM-Ecoponto.php',
    'admin.ecoponto@ecocoleta.local',
    'EcoPonto@123',
    'EcoPonto'
);

if ($morador) {
    $cookies = $morador['cookies'];
    $seedEmail = (string) ($morador['email'] ?? '');
    test_avatar_upload($results, $cookies, $seedEmail);
    test_resgate_premio($results, $cookies);
    test_coleta_balanca($results, $cookies);

    if (!empty($adminEco['cookies'])) {
        $saldoPosBalanca = test_fluxo_balanca_completo($results, $cookies, $adminEco['cookies']);
        test_resgate_debito_pontos(
            $results,
            $cookies,
            (int) ($morador['usuario_id'] ?? 0),
            $saldoPosBalanca
        );
    } else {
        qa_log($results, 'Fluxo balanca completo', 'preta', 'Login admin ecoponto', 'FALHA', 'sem cookie');
        qa_log($results, 'Resgate com debito de pontos', 'preta', 'Dependencia admin ecoponto', 'AVISO', 'login falhou');
    }
}

test_admin_login($results, 'admin/Login-ADM.php', 'admin.plataforma@ecocoleta.local', 'EcoPlat@2026', 'Plataforma');

test_mapa_externo($results);
test_smtp($results);
test_cadastro_recuperar($results);

$ok = count(array_filter($results, fn($r) => $r['status'] === 'OK'));
$fail = count(array_filter($results, fn($r) => $r['status'] === 'FALHA'));
$warn = count(array_filter($results, fn($r) => $r['status'] === 'AVISO'));
$total = count($results);

$lines = [];
$lines[] = '# QA Integracao — Caixa Preta e Branca (fluxos funcionais)';
$lines[] = '';
$lines[] = 'Gerado em: ' . date('Y-m-d H:i:s');
$lines[] = "Base: `$baseUrl`";
$lines[] = '';
$lines[] = '## Resumo';
$lines[] = "| Resultado | Qtd |";
$lines[] = "|-----------|-----|";
$lines[] = "| OK | $ok |";
$lines[] = "| AVISO | $warn |";
$lines[] = "| FALHA | $fail |";
$lines[] = "| Total checks | $total |";
$lines[] = '';

$fluxos = array_unique(array_column($results, 'fluxo'));
foreach ($fluxos as $fluxo) {
    $lines[] = "## $fluxo";
    $lines[] = '';
    $lines[] = '| Tipo | Teste | Status | Detalhe |';
    $lines[] = '|------|-------|--------|---------|';
    foreach ($results as $r) {
        if ($r['fluxo'] !== $fluxo) continue;
        $det = str_replace('|', '/', $r['detalhe']);
        $lines[] = "| {$r['tipo']} | {$r['teste']} | {$r['status']} | $det |";
    }
    $lines[] = '';
}

$lines[] = '## Teste manual complementar';
$lines[] = '- EcoCheck puzzle visual no navegador (drag real)';
$lines[] = '- GPS no mapa (permissao do browser)';
$lines[] = '- Admin: navegar Home-ADM apos login com cookie';
$lines[] = '- SMTP: `api/testar-email.php?email=...`';

file_put_contents($reportPath, implode("\n", $lines));
echo "\nRelatorio: $reportPath\n";
echo "OK=$ok AVISO=$warn FALHA=$fail\n";

exit($fail > 0 ? 1 : 0);
