@echo off
:: Launch script for Faster You web app
:: Assign this to a keyboard shortcut via AutoHotkey or Windows Task Scheduler

set PROJECT=%~dp0..
set NPM=npm

:: Check if server is already running on port 8191
netstat -ano | findstr ":8191 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
  cd /d "%PROJECT%"
  start "" /b cmd /c "%NPM% run dev:web"
  :: Wait for API server to be ready
  :wait
  curl -s http://127.0.0.1:8191/ping >nul 2>&1
  if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait
  )
)

start http://localhost:8190
