#!/bin/bash
# Kill Faster You dev server and Vite

# Kill process on port 8191 (API server)
PID_8191=$(lsof -i :8191 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$PID_8191" ]; then
  kill $PID_8191
  echo "Killed API server (pid $PID_8191)"
fi

# Kill process on port 8190 (Vite)
PID_8190=$(lsof -i :8190 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$PID_8190" ]; then
  kill $PID_8190
  echo "Killed Vite (pid $PID_8190)"
fi
