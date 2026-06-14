@echo off
chcp 65001 >nul
set ROOT=%~dp0..
set SRC=%ROOT%\Imagens
set DST=%ROOT%\assets\images

if not exist "%DST%" mkdir "%DST%"

if exist "%SRC%" (
  echo Copiando Imagens\ para assets\images\ ...
  xcopy /E /I /Y "%SRC%\*" "%DST%\"
  echo Concluido.
) else (
  echo Pasta Imagens\ nao encontrada em %ROOT%
  echo.
  echo Se voce tem backup das imagens, copie os arquivos .png/.jpeg para:
  echo   %DST%
  echo.
  echo Arquivos esperados: logo.2.png, logo telas.png, fundo tela.jpeg, etc.
)

pause
