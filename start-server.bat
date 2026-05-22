@echo off
echo Starting JSCSS Project Server...
echo.
echo Try Node.js server...
node simple-server.js
if %errorlevel% neq 0 (
    echo Node.js not found, trying Python...
    python server.py
    if %errorlevel% neq 0 (
        echo Python not found, trying Python 3...
        python3 -m http.server 8080 --directory docs
        if %errorlevel% neq 0 (
            echo.
            echo ==========================================
            echo No Node.js or Python found!
            echo ==========================================
            echo.
            echo You can:
            echo 1. Install Node.js from https://nodejs.org/
            echo 2. Install Python from https://www.python.org/
            echo 3. Open HTML files directly in your browser:
            echo    - Open docs/index.html in browser
            echo    - Open cool-effects.html in browser
            echo    - Open canvas-demo.html in browser
            echo.
            pause
        )
    )
)
