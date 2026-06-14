<?php

if (!defined('PROJECT_ROOT')) {
    define('PROJECT_ROOT', dirname(__DIR__));
}

if (!function_exists('project_path')) {
    function project_path(string $relative = ''): string
    {
        $relative = ltrim(str_replace(['\\', '/'], DIRECTORY_SEPARATOR, $relative), DIRECTORY_SEPARATOR);
        return $relative === '' ? PROJECT_ROOT : PROJECT_ROOT . DIRECTORY_SEPARATOR . $relative;
    }
}

if (!function_exists('require_project')) {
    function require_project(string $relative): void
    {
        require_once project_path($relative);
    }
}
