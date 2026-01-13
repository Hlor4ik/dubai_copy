@echo off
echo ========================================
echo   Dubai AI Consultant - Starting...
echo ========================================
echo.

REM Check if node_modules exist
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo.
echo Starting Backend on port 3001...
start "Backend" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak > nul

echo Starting Frontend on port 3000...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   Open http://localhost:3000
echo ========================================
echo.
pause

