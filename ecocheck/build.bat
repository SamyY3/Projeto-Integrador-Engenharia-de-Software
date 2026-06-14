@echo off
setlocal
cd /d "%~dp0"

echo EcoCheck build...
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [AVISO] Node.js nao encontrado no PATH.
  echo O bundle em ..\ecocheck-dist\ ja esta disponivel ^(fallback^).
  echo Instale Node.js LTS para rebuild via Vite/React.
  exit /b 0
)

call npm install > build.log 2>&1
if errorlevel 1 (
  echo npm install falhou. Veja build.log
  type build.log
  exit /b 1
)

call npm run build >> build.log 2>&1
if errorlevel 1 (
  echo npm run build falhou. Veja build.log
  type build.log
  exit /b 1
)

echo.
echo Build concluido em ..\ecocheck-dist\
dir /b ..\ecocheck-dist\ecocheck.*
exit /b 0
