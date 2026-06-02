@echo off
REM opencode2api launcher
REM Works on Windows CMD

cd /d "%~dp0"
echo.
echo === opencode2api (Windows) ===

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node missing.
    goto :eof
)
for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VER=%%i
echo Node.js: %NODE_VER%

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm missing.
    goto :eof
)
for /f "tokens=*" %%i in ('npm --version 2^>nul') do set NPM_VER=%%i
echo npm: %NPM_VER%

if not exist "node_modules" (
    echo Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        goto :eof
    )
) else (
    echo node_modules present, skipping npm install.
)

if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env from .env.example...
        copy /Y ".env.example" ".env" >nul
    ) else (
        echo [WARN] .env.example not found. Continuing with no .env.
    )
) else (
    echo .env present.
)

if "%OPENCODE_PROXY_PORT%"=="" set OPENCODE_PROXY_PORT=10000
echo Starting proxy on http://127.0.0.1:%OPENCODE_PROXY_PORT% ...
node index.js
