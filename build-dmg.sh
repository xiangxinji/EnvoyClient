#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
INSTALLER_DIR="$ROOT_DIR/installer"
PAYLOAD_DIR="$INSTALLER_DIR/src-tauri/payload"
MAIN_APP_BUNDLE="$ROOT_DIR/src-tauri/target/release/bundle/macos/Envoy.app"
DMG_OUTPUT="$ROOT_DIR/dist/Envoy_0.1.0.dmg"
DMG_BACKGROUND="$INSTALLER_DIR/dmg-background.png"

echo "========================================"
echo "  Envoy DMG Builder (macOS)"
echo "========================================"
echo ""

# --- Phase 1: Build main app ---
echo "[1/3] Building main application..."
cd "$ROOT_DIR"
npm run build
npm run tauri build

if [ ! -d "$MAIN_APP_BUNDLE" ]; then
    echo "ERROR: .app bundle not found at $MAIN_APP_BUNDLE"
    exit 1
fi
echo "  Main app built successfully."

# --- Phase 2: Generate DMG background (if not exists) ---
mkdir -p "$(dirname "$DMG_OUTPUT")"

# --- Phase 3: Create DMG ---
echo "[2/3] Creating DMG..."

# Use hdiutil to create the DMG
DMG_TEMP="$ROOT_DIR/dist/dmg_temp"
rm -rf "$DMG_TEMP"
mkdir -p "$DMG_TEMP"

# Copy app to temp DMG directory
cp -R "$MAIN_APP_BUNDLE" "$DMG_TEMP/"

# Create Applications symlink
ln -s /Applications "$DMG_TEMP/Applications"

# Create the DMG
hdiutil create -volname "Envoy" \
    -srcfolder "$DMG_TEMP" \
    -ov -format UDZO \
    "$DMG_OUTPUT"

rm -rf "$DMG_TEMP"

echo ""
echo "========================================"
echo "  Output: $DMG_OUTPUT"
echo "========================================"
