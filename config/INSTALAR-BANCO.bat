@echo off
setlocal ENABLEDELAYEDEXPANSION
chcp 65001 >nul
title EcoColeta - Instalar banco de dados

REM ============================================================
REM  Cria o banco "ecocoleta" e roda todos os scripts SQL
REM  na ordem correta usando o mysql.exe do XAMPP.
REM
REM  Requer: MySQL do XAMPP rodando (rode INICIAR-PROJETO.bat antes)
REM  Usuario padrao: root  / Senha padrao: vazia
REM ============================================================

cd /d "%~dp0\.."
set "DB_DIR=%~dp0..\database"

echo ============================================================
echo  EcoColeta - instalando banco de dados...
echo  Pasta do projeto: %CD%
echo ============================================================
echo.

REM ---- Localizar o mysql.exe -----------------------------------------------
set "MYSQL_EXE="
if exist "D:\XAMPP\mysql\bin\mysql.exe" set "MYSQL_EXE=D:\XAMPP\mysql\bin\mysql.exe"
if not defined MYSQL_EXE if exist "D:\xampp\mysql\bin\mysql.exe" set "MYSQL_EXE=D:\xampp\mysql\bin\mysql.exe"
if not defined MYSQL_EXE if exist "C:\xampp\mysql\bin\mysql.exe" set "MYSQL_EXE=C:\xampp\mysql\bin\mysql.exe"
if not defined MYSQL_EXE if exist "C:\XAMPP\mysql\bin\mysql.exe" set "MYSQL_EXE=C:\XAMPP\mysql\bin\mysql.exe"
if not defined MYSQL_EXE if exist "%LocalAppData%\Programs\XAMPP\mysql\bin\mysql.exe" set "MYSQL_EXE=%LocalAppData%\Programs\XAMPP\mysql\bin\mysql.exe"

if not defined MYSQL_EXE (
  echo [ERRO] Nao achei o mysql.exe do XAMPP. Verifique a instalacao.
  pause & exit /b 1
)
echo [OK] mysql.exe: %MYSQL_EXE%
echo.

REM ---- Conferir conexao -----------------------------------------------------
echo Conferindo se o MySQL esta rodando (usuario root, sem senha)...
"%MYSQL_EXE%" -u root -e "SELECT VERSION();" >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Nao consegui conectar no MySQL com root sem senha.
  echo        - Abra o XAMPP Control Panel e clique Start no MySQL, OU
  echo        - Rode primeiro o INICIAR-PROJETO.bat
  echo        Se o root tem senha, edite este .bat e ajuste "-p<senha>".
  pause & exit /b 1
)
echo [OK] MySQL respondeu.
echo.

REM ---- Rodar SQLs em ordem --------------------------------------------------
call :RUN_SQL "1/10 base do banco"                     "SQL_BDD_EcoColeta.sql"              "ignore-db"
call :RUN_SQL "2/10 colunas opcionais do usuario"      "usuario_edicao_opcional.sql"        "ecocoleta"
call :RUN_SQL "3/10 corrigir tipos de expiracao"       "corrigir_tipo_expiracao_codigo.sql" "ecocoleta"
call :RUN_SQL "4/10 premios / beneficios / resgate"    "premios_beneficios_resgate.sql"     "ecocoleta"
call :RUN_SQL "5/10 agendamento de coleta"             "agendamento_coleta_tab.sql"         "ecocoleta"
call :RUN_SQL "6/10 cadastro pendente (verif.email)"   "cadastro_pendente_tab.sql"          "ecocoleta"
call :RUN_SQL "7/10 notificacoes morador"              "notificacao_tab.sql"                "ecocoleta"
call :RUN_SQL "8/10 notificacoes admin"                "notificacao_admin_tab.sql"          "ecocoleta"
call :RUN_SQL "9/10 integracao admin ecoponto"         "admin_ecoponto_integracao.sql"      "ecocoleta"
call :RUN_SQL "10/10 integracao admin plataforma"      "admin_plataforma_integracao.sql"    "ecocoleta"

echo.
echo --------------------------------------------------
echo Rodando seed completo  ^>^>  database\seed_tudo.php
echo --------------------------------------------------
set "PHP_EXE="
if exist "D:\XAMPP\php\php.exe" set "PHP_EXE=D:\XAMPP\php\php.exe"
if not defined PHP_EXE if exist "C:\xampp\php\php.exe" set "PHP_EXE=C:\xampp\php\php.exe"
if defined PHP_EXE (
  "%PHP_EXE%" "database\seed_tudo.php"
) else (
  echo [AVISO] PHP nao encontrado; rode config\SEED-TUDO.bat depois.
)

echo.
echo ============================================================
echo  Banco "ecocoleta" instalado com dados de demonstracao!
echo  Credenciais: database\DADOS-DEMO.md
echo  Agora rode INICIAR-PROJETO.bat (se ja nao estiver rodando)
echo  e acesse:  http://localhost/Ecocoleta/
echo ============================================================
echo.
pause
exit /b 0


:RUN_SQL
REM %1 = descricao  %2 = arquivo  %3 = "ecocoleta" ou "ignore-db"
set "DESC=%~1"
set "FILE=%~2"
set "TARGET_DB=%~3"
set "FULL=%DB_DIR%\%FILE%"

if not exist "%FULL%" (
  echo [PULAR] %DESC% - arquivo "%FULL%" nao encontrado.
  exit /b 0
)
echo --------------------------------------------------
echo Rodando %DESC%   ^>^>  %FILE%
echo --------------------------------------------------

if /i "%TARGET_DB%"=="ignore-db" (
  "%MYSQL_EXE%" -u root --default-character-set=utf8mb4 --force < "%FULL%"
) else (
  "%MYSQL_EXE%" -u root --default-character-set=utf8mb4 --force %TARGET_DB% < "%FULL%"
)
echo.
exit /b 0
