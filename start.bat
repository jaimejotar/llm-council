@echo off
REM LLM Council - Windows launcher (double-click to run)

cd /d "%~dp0"

echo Working directory: %CD%
echo.

if not exist ".venv\Scripts\python.exe" (
    echo ERROR: .venv\Scripts\python.exe not found in %CD%
    echo Run "uv sync" from this folder first.
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo ERROR: frontend\package.json not found in %CD%
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo ERROR: frontend\node_modules not found.
    echo Run "npm install" inside the frontend folder first.
    pause
    exit /b 1
)

echo Starting LLM Council...
echo   Backend:  http://localhost:8001
echo   Frontend: http://localhost:5173
echo.

start "LLM Council - Backend" /d "%~dp0" cmd /k "echo === BACKEND === && .venv\Scripts\python.exe -m backend.main"
timeout /t 2 /nobreak >nul
start "LLM Council - Frontend" /d "%~dp0frontend" cmd /k "echo === FRONTEND === && npm run dev"

echo.
echo Both servers launching in their own windows.
echo Close each window to stop that server.
echo.
pause
