@echo off
title The Gallery of Moments - Wi-Fi sharing
echo Asking for administrator permission (needed to share over Wi-Fi)...
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%~dp0serve.ps1\"','-Lan'"
