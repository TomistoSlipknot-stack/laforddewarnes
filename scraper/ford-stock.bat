@echo off
title La Ford de Warnes - Stock Checker
echo.
echo ========================================
echo   La Ford de Warnes - Stock Checker
echo   Revisando stock cada 30 minutos
echo   NO CERRAR ESTA VENTANA
echo ========================================
echo.

cd /d "%~dp0"
npm install puppeteer mongodb --save 2>nul

node index.cjs

pause
