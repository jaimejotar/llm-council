#!/bin/bash

# LLM Council - Start script

echo "Starting LLM Council..."
echo ""

# Locate project .venv Python (Windows vs POSIX) — bypass uv to avoid VIRTUAL_ENV conflicts
if [ -f ".venv/Scripts/python.exe" ]; then
    PYTHON=".venv/Scripts/python.exe"
elif [ -f ".venv/bin/python" ]; then
    PYTHON=".venv/bin/python"
else
    echo "Error: .venv not found. Run 'uv sync' first."
    exit 1
fi

# Start backend
echo "Starting backend on http://localhost:8001..."
"$PYTHON" -m backend.main &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 2

# Start frontend
echo "Starting frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ LLM Council is running!"
echo "  Backend:  http://localhost:8001"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
