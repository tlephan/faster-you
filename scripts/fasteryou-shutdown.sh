#!/bin/bash
# Kill Faster You dev server and Vite

# Kill process on port 3001 (API server)
PID_3001=$(lsof -i :3001 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$PID_3001" ]; then
  kill $PID_3001
  echo "Killed API server (pid $PID_3001)"
fi

# Kill process on port 3000 (Vite)
PID_3000=$(lsof -i :3000 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$PID_3000" ]; then
  kill $PID_3000
  echo "Killed Vite (pid $PID_3000)"
fi
