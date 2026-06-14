<?php

function ecocheck_iniciar_sessao(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
}

function ecocheck_json(array $payload, int $code = 200): void
{
    http_response_code($code);
    header("Content-Type: application/json; charset=utf-8");
    header("Cache-Control: no-store, no-cache, must-revalidate");
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function ecocheck_limpar_desafios_expirados(): void
{
    if (empty($_SESSION["ecocheck_challenges"]) || !is_array($_SESSION["ecocheck_challenges"])) {
        $_SESSION["ecocheck_challenges"] = [];
        return;
    }
    $agora = time();
    foreach ($_SESSION["ecocheck_challenges"] as $id => $data) {
        if (!is_array($data) || ($data["exp"] ?? 0) < $agora) {
            unset($_SESSION["ecocheck_challenges"][$id]);
        }
    }
}

function ecocheck_novo_desafio_metricas(): array
{
    $width = 300;
    $height = 150;
    $pieceSize = 52;
    $minX = $pieceSize + 12;
    $maxX = $width - $pieceSize - 12;
    $targetX = random_int($minX, $maxX);

    return compact("width", "height", "pieceSize", "targetX");
}

function ecocheck_gerar_imagens_puzzle(int $width, int $height, int $pieceSize, int $targetX): ?array
{
    if (!function_exists("imagecreatetruecolor")) {
        return null;
    }

    $bg = imagecreatetruecolor($width, $height);
    if (!$bg) {
        return null;
    }

    imagealphablending($bg, true);
    imagesavealpha($bg, true);

    for ($y = 0; $y < $height; $y++) {
        $ratio = $y / max(1, $height - 1);
        $r = (int) (232 - $ratio * 40);
        $g = (int) (248 - $ratio * 20);
        $b = (int) (238 - $ratio * 30);
        $linha = imagecolorallocate($bg, $r, $g, $b);
        imageline($bg, 0, $y, $width, $y, $linha);
    }

    for ($i = 0; $i < 6; $i++) {
        $cx = random_int(20, $width - 20);
        $cy = random_int(15, $height - 15);
        $rad = random_int(18, 42);
        $c = imagecolorallocatealpha($bg, 18, 130, 86, random_int(40, 90));
        imagefilledellipse($bg, $cx, $cy, $rad, $rad, $c);
    }

    $pieceY = (int) (($height - $pieceSize) / 2);
    $piece = imagecreatetruecolor($pieceSize, $pieceSize);
    if (!$piece) {
        imagedestroy($bg);
        return null;
    }
    imagealphablending($piece, true);
    imagesavealpha($piece, true);
    $trans = imagecolorallocatealpha($piece, 0, 0, 0, 127);
    imagefill($piece, 0, 0, $trans);

    imagecopy($piece, $bg, 0, 0, $targetX, $pieceY, $pieceSize, $pieceSize);

    $sombra = imagecolorallocatealpha($bg, 10, 60, 40, 70);
    imagefilledrectangle($bg, $targetX, $pieceY, $targetX + $pieceSize, $pieceY + $pieceSize, $sombra);
    $borda = imagecolorallocate($bg, 143, 255, 199);
    imagerectangle($bg, $targetX, $pieceY, $targetX + $pieceSize - 1, $pieceY + $pieceSize - 1, $borda);

    ob_start();
    imagepng($bg);
    $bgBin = ob_get_clean();
    ob_start();
    imagepng($piece);
    $pieceBin = ob_get_clean();
    imagedestroy($bg);
    imagedestroy($piece);

    if ($bgBin === false || $pieceBin === false) {
        return null;
    }

    return [
        "bg" => "data:image/png;base64," . base64_encode($bgBin),
        "piece" => "data:image/png;base64," . base64_encode($pieceBin),
    ];
}

function ecocheck_gerar_svg_puzzle(int $width, int $height, int $pieceSize, int $targetX): array
{
    $pieceY = (int) (($height - $pieceSize) / 2);
    $bgSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="' . $width . '" height="' . $height . '">'
        . '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        . '<stop offset="0%" stop-color="#e8f8ef"/><stop offset="100%" stop-color="#c8ead8"/>'
        . '</linearGradient></defs>'
        . '<rect width="100%" height="100%" fill="url(#g)"/>'
        . '<circle cx="60" cy="40" r="28" fill="rgba(18,160,106,0.25)"/>'
        . '<circle cx="220" cy="95" r="34" fill="rgba(15,107,74,0.18)"/>'
        . '<rect x="' . $targetX . '" y="' . $pieceY . '" width="' . $pieceSize . '" height="' . $pieceSize . '" fill="rgba(10,61,46,0.35)" stroke="#8fffc7" stroke-width="2"/>'
        . '</svg>';

    $pieceSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="' . $pieceSize . '" height="' . $pieceSize . '">'
        . '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        . '<stop offset="0%" stop-color="#e8f8ef"/><stop offset="100%" stop-color="#c8ead8"/>'
        . '</linearGradient></defs>'
        . '<rect width="100%" height="100%" fill="url(#g)"/>'
        . '</svg>';

    return [
        "bg" => "data:image/svg+xml;base64," . base64_encode($bgSvg),
        "piece" => "data:image/svg+xml;base64," . base64_encode($pieceSvg),
    ];
}

function ecocheck_criar_desafio(): array
{
    ecocheck_limpar_desafios_expirados();
    $m = ecocheck_novo_desafio_metricas();
    $id = bin2hex(random_bytes(16));
    $pieceY = (int) (($m["height"] - $m["pieceSize"]) / 2);

    $imagens = ecocheck_gerar_imagens_puzzle(
        $m["width"],
        $m["height"],
        $m["pieceSize"],
        $m["targetX"]
    );

    $_SESSION["ecocheck_challenges"][$id] = [
        "targetX" => $m["targetX"],
        "pieceY" => $pieceY,
        "width" => $m["width"],
        "height" => $m["height"],
        "pieceSize" => $m["pieceSize"],
        "exp" => time() + 300,
        "used" => false,
    ];

    $out = [
        "sucesso" => true,
        "challengeId" => $id,
        "width" => $m["width"],
        "height" => $m["height"],
        "pieceSize" => $m["pieceSize"],
        "pieceY" => $pieceY,
        "expiresIn" => 300,
    ];

    if ($imagens) {
        $out["background"] = $imagens["bg"];
        $out["piece"] = $imagens["piece"];
    } else {
        $svg = ecocheck_gerar_svg_puzzle(
            $m["width"],
            $m["height"],
            $m["pieceSize"],
            $m["targetX"]
        );
        $out["background"] = $svg["bg"];
        $out["piece"] = $svg["piece"];
    }

    return $out;
}

function ecocheck_verificar_desafio(array $input): array
{
    ecocheck_limpar_desafios_expirados();

    $challengeId = trim((string) ($input["challengeId"] ?? ""));
    $posX = isset($input["positionX"]) ? (float) $input["positionX"] : -1;
    $durationMs = isset($input["durationMs"]) ? (int) $input["durationMs"] : 0;
    $samples = isset($input["sampleCount"]) ? (int) $input["sampleCount"] : 0;
    $straightRatio = isset($input["straightRatio"]) ? (float) $input["straightRatio"] : 1;
    $velocityStd = isset($input["velocityStd"]) ? (float) $input["velocityStd"] : 0;
    $hp = trim((string) ($input["honeypot"] ?? ""));

    if ($hp !== "") {
        return ["sucesso" => false, "erro" => "Falha na verificacao EcoCheck."];
    }

    if ($challengeId === "" || !isset($_SESSION["ecocheck_challenges"][$challengeId])) {
        return ["sucesso" => false, "erro" => "Desafio expirado. Tente novamente."];
    }

    $challenge = $_SESSION["ecocheck_challenges"][$challengeId];
    if (!empty($challenge["used"])) {
        return ["sucesso" => false, "erro" => "Desafio ja utilizado."];
    }

    if ($durationMs < 700) {
        return ["sucesso" => false, "erro" => "Resolucao rapida demais. Tente de novo."];
    }

    if ($samples < 6) {
        return ["sucesso" => false, "erro" => "Movimento insuficiente detectado."];
    }

    if ($straightRatio > 0.985 && $velocityStd < 0.02 && $durationMs < 900) {
        return ["sucesso" => false, "erro" => "Padrao de movimento suspeito."];
    }

    if ($velocityStd < 0.015 && $durationMs < 1200) {
        return ["sucesso" => false, "erro" => "Velocidade nao humana detectada."];
    }

    $targetX = (int) $challenge["targetX"];
    $tolerance = 10;
    if (abs($posX - $targetX) > $tolerance) {
        $_SESSION["ecocheck_challenges"][$challengeId]["used"] = true;
        return ["sucesso" => false, "erro" => "Encaixe incorreto. Novo puzzle gerado.", "retry" => true];
    }

    $_SESSION["ecocheck_challenges"][$challengeId]["used"] = true;

    $token = bin2hex(random_bytes(24));
    $_SESSION["ecocheck_verified_token"] = $token;
    $_SESSION["ecocheck_verified_exp"] = time() + 600;

    return [
        "sucesso" => true,
        "token" => $token,
        "expiresIn" => 600,
        "mensagem" => "Verificacao humana concluida.",
    ];
}

function ecocheck_token_valido_na_requisicao(): bool
{
    ecocheck_iniciar_sessao();
    $token = trim((string) ($_POST["ecocheck_token"] ?? $_SERVER["HTTP_X_ECOCHECK_TOKEN"] ?? ""));
    if ($token === "") {
        return false;
    }
    $sessao = (string) ($_SESSION["ecocheck_verified_token"] ?? "");
    $exp = (int) ($_SESSION["ecocheck_verified_exp"] ?? 0);
    if ($sessao === "" || $exp < time()) {
        return false;
    }
    return hash_equals($sessao, $token);
}

function ecocheck_exigir_token(): void
{
    if (!ecocheck_token_valido_na_requisicao()) {
        ecocheck_json([
            "sucesso" => false,
            "erro" => "Verificacao EcoCheck obrigatoria. Conclua o puzzle anti-bot.",
        ]);
    }
}

function ecocheck_limpar_verificacao_sessao(): void
{
    ecocheck_iniciar_sessao();
    unset(
        $_SESSION["ecocheck_verified_token"],
        $_SESSION["ecocheck_verified_exp"],
        $_SESSION["ecocheck_challenges"]
    );
}
