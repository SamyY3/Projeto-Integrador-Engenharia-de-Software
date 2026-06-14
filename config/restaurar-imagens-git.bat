@echo off
chcp 65001 >nul
cd /d "%~dp0.."
where git >nul 2>&1 || (
  echo Git nao encontrado. Use restaurar-imagens.bat com a pasta Imagens.
  pause
  exit /b 1
)
echo Tentando restaurar Imagens do Git...
git checkout HEAD -- Imagens 2>nul
if exist "Imagens" (
  call "%~dp0restaurar-imagens.bat"
) else (
  echo Nenhum historico Git com a pasta Imagens. Copie o backup manualmente para assets\images\
  pause
)
