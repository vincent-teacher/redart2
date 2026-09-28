@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo   楊梅高中紅土藝術空間 網站更新
echo   來源：上一層的「紅土藝術空間」資料夾
echo ==========================================
python -X utf8 tools\build.py
if errorlevel 1 (
  echo.
  echo 發生錯誤：請確認已安裝 Python 3 與 Pillow（pip install pillow）
)
echo.
echo 完成！按任意鍵開啟網站…
pause >nul
start "" "%~dp0index.html"
