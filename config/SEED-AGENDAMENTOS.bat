@echo off
chcp 65001 >nul
title EcoColeta - Seed agendamentos
cd /d "%~dp0\.."
set "PHP_EXE="
if exist "C:\xampp\php\php.exe" set "PHP_EXE=C:\xampp\php\php.exe"
if not defined PHP_EXE where php >nul 2>&1 && set "PHP_EXE=php"
if not defined PHP_EXE (echo [ERRO] PHP nao encontrado. & pause & exit /b 1)
"%PHP_EXE%" "%~dp0..\database\seed_agendamentos.php" %*
pause
