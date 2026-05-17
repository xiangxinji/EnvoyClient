# 收集主应用构建产物到 installer payload 目录
# 用法: powershell -ExecutionPolicy Bypass -File collect-payload.ps1

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PayloadDir = Join-Path (Join-Path (Join-Path $RootDir "installer") "src-tauri") "payload"
$ReleaseDir = Join-Path (Join-Path (Join-Path $RootDir "src-tauri") "target") "release"

if (-not (Test-Path $ReleaseDir)) {
    Write-Host "ERROR: 主应用尚未构建，请先运行 npm run tauri build" -ForegroundColor Red
    exit 1
}

# 清空 payload
if (Test-Path $PayloadDir) {
    Remove-Item $PayloadDir -Recurse -Force
}
New-Item -ItemType Directory -Path $PayloadDir -Force | Out-Null

# 主程序
Copy-Item (Join-Path $ReleaseDir "envoy.exe") $PayloadDir
Write-Host "  envoy.exe" -ForegroundColor Gray

# DLL
Get-ChildItem -Path $ReleaseDir -Filter "*.dll" | ForEach-Object {
    Copy-Item $_.FullName $PayloadDir
    Write-Host "  $($_.Name)" -ForegroundColor Gray
}

# brains 目录
$brains = Join-Path (Join-Path $RootDir "src-tauri") "brains"
if (Test-Path $brains) {
    Copy-Item -Path $brains -Destination (Join-Path $PayloadDir "brains") -Recurse
    Write-Host "  brains/" -ForegroundColor Gray
}

# icon
Copy-Item (Join-Path (Join-Path (Join-Path $RootDir "src-tauri") "icons") "icon.png") $PayloadDir
Write-Host "  icon.png" -ForegroundColor Gray

$total = (Get-ChildItem $PayloadDir -Recurse | Measure-Object -Property Length -Sum).Sum
Write-Host ""
Write-Host "Payload ready: $([math]::Round($total / 1MB, 1)) MB" -ForegroundColor Green
