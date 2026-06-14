@echo off
setlocal ENABLEDELAYEDEXPANSION
chcp 65001 >nul
title EcoColeta - Reparar MySQL

echo ============================================================
echo  EcoColeta - reparo rapido das tabelas do sistema MySQL
echo ============================================================
echo.

set "XAMPP="
if exist "D:\XAMPP\mysql\bin\aria_chk.exe" set "XAMPP=D:\XAMPP"
if not defined XAMPP if exist "C:\xampp\mysql\bin\aria_chk.exe" set "XAMPP=C:\xampp"

if not defined XAMPP (
  echo [ERRO] Nao encontrei o XAMPP com aria_chk.exe
  pause
  exit /b 1
)

echo [1/3] Parando MySQL se estiver rodando...
taskkill /F /IM mysqld.exe >nul 2>&1
ping -n 3 127.0.0.1 >nul

echo [2/3] Reparando tabelas Aria do sistema (mysql.db, mysql.user)...
"%XAMPP%\mysql\bin\aria_chk.exe" -r "%XAMPP%\mysql\data\mysql\db"
"%XAMPP%\mysql\bin\aria_chk.exe" -r "%XAMPP%\mysql\data\mysql\user"
"%XAMPP%\mysql\bin\aria_chk.exe" -r "%XAMPP%\mysql\data\mysql\tables_priv"

echo [3/3] Iniciando MySQL...
start "" /min "%XAMPP%\mysql_start.bat"
ping -n 8 127.0.0.1 >nul

"%XAMPP%\mysql\bin\mysql.exe" -u root -e "SELECT 1" >nul 2>&1
if errorlevel 1 (
  echo.
  echo [AVISO] MySQL ainda nao respondeu. Abra o XAMPP Control Panel
  echo         e clique Start no MySQL. Se falhar, veja:
  echo         %XAMPP%\mysql\data\mysql_error.log
) else (
  echo.
  echo [OK] MySQL respondeu. Rode INSTALAR-BANCO.bat se for a primeira vez.
)

echo.
pause
endlocal
