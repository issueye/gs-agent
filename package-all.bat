@echo off
REM package-all.bat - Windows 完整打包脚本

chcp 65001 >nul
echo === GTS System Complete Package ===
echo.

set DIST_DIR=dist\release

REM 1. Build GoScript
echo [1/4] Building GoScript...
cd gts
go build -ldflags="-s -w" -o gs.exe ./cmd/gs
if %ERRORLEVEL% NEQ 0 exit /b 1
cd ..
echo [OK] GoScript build complete
echo.

REM 2. Package Agent
echo [2/4] Packaging Agent...
cd gs-agent
..\gts\gs.exe --timeout 60s dist . ..\dist\gs-agent.exe
if %ERRORLEVEL% NEQ 0 exit /b 1
cd ..
echo [OK] Agent package complete
echo.

REM 3. Package Gateway
echo [3/4] Packaging Gateway...
cd gs-gateway
..\gts\gs.exe --timeout 60s dist . ..\dist\gs-gateway.exe
if %ERRORLEVEL% NEQ 0 exit /b 1
cd ..
echo [OK] Gateway package complete
echo.

REM 4. Build Desktop
echo [4/4] Building Desktop...
cd desktop
wails3 build
if %ERRORLEVEL% NEQ 0 exit /b 1
cd ..
echo [OK] Desktop build complete
echo.

REM 5. Assemble release
echo Assembling release package...
if exist %DIST_DIR% rmdir /s /q %DIST_DIR%
mkdir %DIST_DIR%

copy dist\gs-agent.exe %DIST_DIR%\
copy dist\gs-gateway.exe %DIST_DIR%\
copy desktop\build\bin\desktop.exe %DIST_DIR%\ 2>nul || copy desktop\bin\desktop.exe %DIST_DIR%\

REM Create start script
echo @echo off > %DIST_DIR%\start.bat
echo start /B gs-gateway.exe >> %DIST_DIR%\start.bat
echo timeout /t 2 /nobreak ^>nul >> %DIST_DIR%\start.bat
echo start desktop.exe >> %DIST_DIR%\start.bat

REM Create README
echo GTS System - Release Package > %DIST_DIR%\README.txt
echo. >> %DIST_DIR%\README.txt
echo Files: >> %DIST_DIR%\README.txt
echo - gs-agent.exe      Agent executable >> %DIST_DIR%\README.txt
echo - gs-gateway.exe    Gateway executable >> %DIST_DIR%\README.txt
echo - desktop.exe       Desktop application >> %DIST_DIR%\README.txt
echo. >> %DIST_DIR%\README.txt
echo Usage: >> %DIST_DIR%\README.txt
echo   Double click start.bat >> %DIST_DIR%\README.txt

echo.
echo === Package Complete ===
echo.
echo Release package: %DIST_DIR%
echo.
dir %DIST_DIR%
echo.
pause
