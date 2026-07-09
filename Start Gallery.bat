@echo off
title The Gallery of Moments
start "Gallery Server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
timeout /t 2 /nobreak >nul
start "" http://localhost:8321/
