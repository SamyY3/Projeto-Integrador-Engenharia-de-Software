<?php

function ecocoleta_session_cookie_path(): string
{
    $uri = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/'));
    if (preg_match('#^(/.+?)/(auth|admin|api|pages|mapa)/#', $uri, $m)) {
        return $m[1] . '/';
    }
    if (preg_match('#^(/.+)/[^/]+$#', $uri, $m)) {
        return $m[1] . '/';
    }
    return '/';
}

function ecocoleta_session_start(): void
{
    if (session_status() !== PHP_SESSION_NONE) {
        return;
    }

    $isSecure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => ecocoleta_session_cookie_path(),
            'secure' => $isSecure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    } else {
        session_set_cookie_params(0, ecocoleta_session_cookie_path(), '', $isSecure, true);
    }

    session_start();
}
