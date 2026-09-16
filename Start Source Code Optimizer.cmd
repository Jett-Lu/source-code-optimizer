@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12 or newer is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\terser" (
  echo Dependencies are missing. Run npm install, then npm run build.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo The app has not been built. Run npm run build first.
  pause
  exit /b 1
)
echo Source Code Optimizer opens at http://127.0.0.1:4173
echo Keep this window open. Close it to stop the app.
node server.mjs --open
pause