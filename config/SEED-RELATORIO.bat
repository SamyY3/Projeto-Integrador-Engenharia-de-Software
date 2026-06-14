@echo off
setlocal ENABLEDELAYEDEXPANSION
chcp 65001 >nul
title EcoColeta - Seed Relatórios

REM ============================================================
REM  Popula entregas por mês para admin/relatorio-adm.html
REM  (coleta mensal, evolução, materiais, impacto ambiental)
REM
REM    SEED-RELATORIO.bat
REM    SEED-RELATORIO.bat --fresh
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
  echo [ERRO] PHP nao encontrado. Instale o XAMPP.
  pause
  exit /b 1
)

echo ============================================================
echo  EcoColeta - seed Relatorios ^(coleta mensal^)
echo ============================================================
echo.

"%PHP_EXE%" "%~dp0..\database\seed_relatorio.php" %*
set "ERR=%ERRORLEVEL%"

echo.
if not "%ERR%"=="0" (
  echo [ERRO] Seed falhou com codigo %ERR%.
  pause
  exit /b %ERR%
)

pause
exit /b 0
