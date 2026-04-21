@echo off
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

if not exist node_modules (
  echo [build.bat] 初回セットアップ: npm install 実行中...
  call npm install
)

echo [build.bat] 本番ビルドを dist\ に出力します
call npm run build
pause
