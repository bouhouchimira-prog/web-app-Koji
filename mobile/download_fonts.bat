@echo off
echo Downloading Outfit font files...
echo.

curl -L "https://github.com/google/fonts/raw/main/ofl/outfit/Outfit-Regular.ttf" -o "assets\fonts\Outfit-Regular.ttf"
if %errorlevel% neq 0 (
    echo Failed to download Outfit-Regular.ttf
    exit /b 1
)
echo Downloaded Outfit-Regular.ttf

curl -L "https://github.com/google/fonts/raw/main/ofl/outfit/Outfit-SemiBold.ttf" -o "assets\fonts\Outfit-SemiBold.ttf"
if %errorlevel% neq 0 (
    echo Failed to download Outfit-SemiBold.ttf
    exit /b 1
)
echo Downloaded Outfit-SemiBold.ttf

curl -L "https://github.com/google/fonts/raw/main/ofl/outfit/Outfit-Bold.ttf" -o "assets\fonts\Outfit-Bold.ttf"
if %errorlevel% neq 0 (
    echo Failed to download Outfit-Bold.ttf
    exit /b 1
)
echo Downloaded Outfit-Bold.ttf

echo.
echo All fonts downloaded successfully!
echo You can now run: flutter pub get
