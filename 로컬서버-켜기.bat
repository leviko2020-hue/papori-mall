@echo off
cd /d "%~dp0"
echo PAPORI 로컬 서버를 시작합니다...
echo 이 창을 닫으면 서버도 꺼집니다.
echo 시작되면 Chrome 주소창에 http://localhost:8090 입력하세요.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File ".claude\static-server.ps1" -Port 8090
pause
