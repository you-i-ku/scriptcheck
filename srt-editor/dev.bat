@echo off
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

if not exist node_modules (
  echo [dev.bat] 初回セットアップ: npm install 実行中...
  call npm install
)

echo [dev.bat] http://localhost:5173 で起動します
call npm run dev
pause
