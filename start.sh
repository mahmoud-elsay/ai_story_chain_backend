#!/bin/bash

# AI Story Chain Server Startup Script

echo "🎭 AI Story Chain Server"
echo "========================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📋 Copying env.example to .env..."
    cp env.example .env
    echo "✅ Please edit .env and add your GEMINI_API_KEY"
    echo "🔑 Get your API key from: https://makersuite.google.com/app/apikey"
    exit 1
fi

# Check if GEMINI_API_KEY is set
if ! grep -q "GEMINI_API_KEY=your_gemini_api_key_here" .env; then
    echo "✅ Environment configuration found"
else
    echo "⚠️  Please set your GEMINI_API_KEY in .env file"
    echo "🔑 Get your API key from: https://makersuite.google.com/app/apikey"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🚀 Starting server..."
echo "📡 WebSocket server will be available at: ws://localhost:3000"
echo "🧪 Test client available at: test-client.html"
echo "📚 API documentation available in README.md"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm run dev
