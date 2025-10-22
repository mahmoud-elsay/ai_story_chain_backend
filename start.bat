@echo off
REM AI Story Chain Server Startup Script for Windows

echo 🎭 AI Story Chain Server
echo ========================

REM Check if .env file exists
if not exist .env (
    echo ⚠️  .env file not found!
    echo 📋 Copying env.example to .env...
    copy env.example .env
    echo ✅ Please edit .env and add your GEMINI_API_KEY
    echo 🔑 Get your API key from: https://makersuite.google.com/app/apikey
    pause
    exit /b 1
)

REM Check if GEMINI_API_KEY is set
findstr /C:"GEMINI_API_KEY=your_gemini_api_key_here" .env >nul
if %errorlevel% equ 0 (
    echo ⚠️  Please set your GEMINI_API_KEY in .env file
    echo 🔑 Get your API key from: https://makersuite.google.com/app/apikey
    pause
    exit /b 1
)

echo ✅ Environment configuration found

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo 📦 Installing dependencies...
    npm install
)

echo 🚀 Starting server...
echo 📡 WebSocket server will be available at: ws://localhost:3000
echo 🧪 Test client available at: test-client.html
echo 📚 API documentation available in README.md
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the server
npm run dev
