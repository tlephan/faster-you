#!/bin/bash
# Launch script for Faster You web app
# Assign this to a keyboard shortcut via macOS Shortcuts app

PROJECT="/Users/thanhphan/Documents/Workspace-Me/github/faster-you"
NPM="/opt/homebrew/bin/npm"

# Start dev server if not already running
if ! lsof -i :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
  cd "$PROJECT"
  $NPM run dev:web &>/dev/null &
  # Wait for API server to be ready
  while ! curl -s http://127.0.0.1:3001/ping >/dev/null 2>&1; do
    sleep 0.5
  done
fi

open http://localhost:3000
