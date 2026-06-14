@echo off
setlocal ENABLEDELAYEDEXPANSION
chcp 65001 >nul
title EcoColeta - Seed completo do banco

REM ============================================================
REM  Popula usuarios, ecopontos, coletas, agendamentos, entregas,
REM  resgates, notificacoes, premios e admins no MySQL.
REM
REM    SEED-TUDO.bat           primeira vez ou completar faltantes
REM    SEED-TUDO.bat --fresh   apaga e recria dados seed
REM ============================================================

cd /d "%~dp0\.."

set "PHP_EXE="
if exist "C:\xampp\php\php.exe" set "PHP_EXE=C:\xampp\php\php.exe"
if not defined PHP_EXE if exist "D:\xampp\php\php.exe" set "PHP_EXE=D:\xampp\php\php.exe"
if not defined PHP_EXE if exist "D:\XAMPP\php\php.exe" set "PHP_EXE=D:\XAMPP\php\php.exe"

if not defined PHP_EXE (
  where php >nul 2>&1
  if not errorlevel 1 set "PHP_EXE=php"
)

if not defined PHP_EXE (
  echo [ERRO] PHP nao encontrado. Instale o XAMPP ou adicione php ao PATH.
  pause
  exit /b 1
)

echo ============================================================
echo  EcoColeta - seed completo (MySQL)
echo ============================================================
echo.

"%PHP_EXE%" "%~dp0..\database\seed_tudo.php" %*
set "ERR=%ERRORLEVEL%"

echo.
if not "%ERR%"=="0" (
  echo [ERRO] Seed falhou com codigo %ERR%.
  pause
  exit /b %ERR%
)

echo.
pause
exit /b 0
