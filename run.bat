@echo off
cd /d "%~dp0"
venv\Scripts\python.exe convert_srt_to_pdf.py
pause
