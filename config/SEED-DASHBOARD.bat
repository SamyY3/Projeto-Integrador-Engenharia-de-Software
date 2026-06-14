@echo off
cd /d "%~dp0.."
echo.
echo === Seed complementar — entregas, resgates, notificacoes (EcoColeta) ===
echo.
if exist "D:\XAMPP\php\php.exe" (
  "D:\XAMPP\php\php.exe" database\seed_complementar.php %*
) else if exist "C:\xampp\php\php.exe" (
  "C:\xampp\php\php.exe" database\seed_complementar.php %*
) else (
  php database\seed_complementar.php %*
)
echo.
pause
