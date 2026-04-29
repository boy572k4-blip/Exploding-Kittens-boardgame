@echo off
echo ========================================
echo   RESET VA CHAY LAI EXPLODING KITTENS
echo ========================================
echo.

echo Buoc 1: Dung tat ca process cu...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM tsx.exe 2>nul
timeout /t 2 /nobreak >nul

echo Buoc 2: Build client...
cd client
call npm run build
cd ..

echo Buoc 3: Chay server...
cd server
start "Exploding Kittens Server" cmd /k "npm start"
cd ..

echo.
echo ========================================
echo   HOAN THANH!
echo ========================================
echo.
echo Server dang chay tai: http://localhost:8888
echo.
echo De choi online:
echo 1. Chay: ngrok http 8888
echo 2. Vao URL ngrok de choi
echo.
echo De choi local:
echo - Vao: http://localhost:8888
echo.
pause