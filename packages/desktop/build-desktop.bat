@echo off
echo ===========================================
echo GlobalCloud XiaoC Desktop Build Script
echo ===========================================

echo Step 1: Installing electron packager...
npm install @electron/packager@latest --no-save

echo Step 2: Building web application...
cd ../web
pnpm run build
if %errorlevel% neq 0 (
    echo Web build failed!
    pause
    exit /b 1
)

echo Step 3: Copying web files...
cd ../desktop-standalone
robocopy ../web/dist web-dist /E /NFL /NDL /NJH /NJS /NC /NS /NP >nul

echo Step 4: Packaging desktop application...
npx electron-packager . globalcloud-xiaoc --platform=win32 --arch=x64 --out=dist --overwrite --ignore=node_modules --electron-version=33.0.0

if %errorlevel% neq 0 (
    echo Desktop packaging failed!
    pause
    exit /b 1
)

echo Step 5: Creating ZIP archive...
powershell -Command "Compress-Archive -Path 'dist\globalcloud-xiaoc-win32-x64' -DestinationPath 'dist\globalcloud-xiaoc-windows-x64.zip' -Force"

echo ===========================================
echo Build completed successfully!
echo ===========================================
echo Location: dist\globalcloud-xiaoc-windows-x64.zip
echo Size: 
for %%i in (dist\globalcloud-xiaoc-windows-x64.zip) do echo %%~zi bytes

echo.
echo Press any key to exit...
pause >nul
