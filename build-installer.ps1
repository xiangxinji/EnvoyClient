# Envoy Installer Build Script (Windows)
# Usage: powershell -ExecutionPolicy Bypass -File build-installer.ps1

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallerDir = Join-Path $RootDir "installer"
$PayloadDir = Join-Path $InstallerDir "src-tauri" "payload"
$MainTauriTarget = Join-Path $RootDir "src-tauri" "target" "release"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Envoy Installer Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Phase 1: Build main app ---
Write-Host "[1/4] Building main application..." -ForegroundColor Yellow
Push-Location $RootDir
npm run build
npm run tauri build
Pop-Location

if (-not (Test-Path $MainTauriTarget)) {
    Write-Host "ERROR: Main app build output not found at $MainTauriTarget" -ForegroundColor Red
    exit 1
}

Write-Host "  Main app built successfully." -ForegroundColor Green

# --- Phase 2: Collect payload ---
Write-Host "[2/4] Collecting payload files..." -ForegroundColor Yellow

if (Test-Path $PayloadDir) {
    Remove-Item $PayloadDir -Recurse -Force
}
New-Item -ItemType Directory -Path $PayloadDir -Force | Out-Null

# Copy the main exe
$mainExe = Join-Path $MainTauriTarget "envoy.exe"
if (Test-Path $mainExe) {
    Copy-Item $mainExe $PayloadDir
    Write-Host "  Copied envoy.exe" -ForegroundColor Gray
} else {
    Write-Host "ERROR: envoy.exe not found in build output" -ForegroundColor Red
    exit 1
}

# Copy DLLs
Get-ChildItem -Path $MainTauriTarget -Filter "*.dll" | ForEach-Object {
    Copy-Item $_.FullName $PayloadDir
    Write-Host "  Copied $($_.Name)" -ForegroundColor Gray
}

# Copy brains directory
$brainsSource = Join-Path $RootDir "src-tauri" "brains"
if (Test-Path $brainsSource) {
    Copy-Item -Path $brainsSource -Destination (Join-Path $PayloadDir "brains") -Recurse
    Write-Host "  Copied brains/" -ForegroundColor Gray
}

# Copy icons
$iconsSource = Join-Path $RootDir "src-tauri" "icons" "icon.png"
if (Test-Path $iconsSource) {
    Copy-Item $iconsSource $PayloadDir
    Write-Host "  Copied icon.png" -ForegroundColor Gray
}

Write-Host "  Payload ready." -ForegroundColor Green

# --- Phase 3: Build installer ---
Write-Host "[3/4] Building installer..." -ForegroundColor Yellow
Push-Location $InstallerDir

if (-not (Test-Path "node_modules")) {
    npm install
}

npm run build
npm run tauri build
Pop-Location

Write-Host "  Installer built successfully." -ForegroundColor Green

# --- Phase 4: Collect output ---
Write-Host "[4/4] Collecting output..." -ForegroundColor Yellow

$OutputDir = Join-Path $RootDir "dist"
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$installerExe = Join-Path $InstallerDir "src-tauri" "target" "release" "EnvoyInstaller.exe"
if (Test-Path $installerExe) {
    $outputName = "Envoy_Setup_0.1.0_x64.exe"
    Copy-Item $installerExe (Join-Path $OutputDir $outputName) -Force
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Output: dist\$outputName" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    # Try NSIS bundle
    $nsisExe = Get-ChildItem -Path (Join-Path $InstallerDir "src-tauri" "target" "release" "bundle" "nsis") -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($nsisExe) {
        Copy-Item $nsisExe.FullName $OutputDir -Force
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Output: dist\$($nsisExe.Name)" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Installer executable not found" -ForegroundColor Red
        exit 1
    }
}
