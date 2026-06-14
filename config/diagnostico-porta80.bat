@echo off
chcp 65001 >nul
echo ========================================
echo   O que esta usando a porta 80?
echo ========================================
netstat -ano | findstr ":80 "
echo.
echo Se aparecer PID que NAO e o Apache do XAMPP, pode ser IIS ou outro programa.
echo PID do processo: veja no Gerenciador de Tarefas - Detalhes.
echo.
echo ========================================
echo   Modulo PHP no Apache (XAMPP)?
echo ========================================
if exist "C:\xampp\apache\bin\httpd.exe" (
  "C:\xampp\apache\bin\httpd.exe" -M 2>nul | findstr /i "php"
  if errorlevel 1 echo NENHUM modulo com "php" na lista - PHP nao esta carregado no Apache.
) else (
  echo C:\xampp\apache\bin\httpd.exe nao encontrado.
)
echo.
echo ========================================
echo   Servico IIS (World Wide Web)?
echo ========================================
sc query W3SVC 2>nul | findstr "STATE"
echo.
echo ========================================
echo   Solucao garantida (PHP funciona):
echo   INICIAR-PROJETO.bat  ^>^>  http://localhost/Ecocoleta/
echo ========================================
pause
