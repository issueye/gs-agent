@echo off
chcp 65001 >nul
REM build.bat - GTS Windows Build Script

echo === GTS System Build ===
echo.

REM Check Go
where go >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Go not found
    exit /b 1
)
echo [OK] Go installed

REM Check npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm not found
    exit /b 1
)
echo [OK] npm installed
echo.

REM Build GoScript
echo Building GoScript...
cd gts
go build -o gs.exe ./cmd/gs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] GoScript build failed
    exit /b 1
)
echo [OK] GoScript build success
cd ..
echo.

REM Build Desktop
echo Building Desktop...
cd desktop\frontend
call npm install
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Desktop build failed
    exit /b 1
)
echo [OK] Desktop build success
cd ..\..
echo.

REM Copy files
echo Copying binaries...
if not exist dist\bin mkdir dist\bin
copy gts\gs.exe dist\bin\
echo [OK] Copy complete
echo.

REM Create scripts
echo Creating start scripts...

echo @echo off > dist\start-gateway.bat
echo cd gs-gateway >> dist\start-gateway.bat
echo ..\dist\bin\gs.exe main.gs >> dist\start-gateway.bat

echo @echo off > dist\start-agent.bat
echo cd gs-agent >> dist\start-agent.bat
echo ..\dist\bin\gs.exe main.gs >> dist\start-agent.bat

echo [OK] Scripts created
echo.

echo === Build Complete ===
echo.
echo Binaries:
echo   - dist\bin\gs.exe
echo.
echo Start:
echo   - Gateway: dist\start-gateway.bat
echo   - Agent:   dist\start-agent.bat
echo.

pause
