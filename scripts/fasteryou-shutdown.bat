@echo off
:: Kill Faster You dev server and Vite

:: Kill process on port 8191 (API server)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8191 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
  echo Killed API server (pid %%a)
)

:: Kill process on port 8190 (Vite)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8190 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
  echo Killed Vite (pid %%a)
)
