use tauri::State;

use super::monitor_manager::{enumerate_native_monitors, virtual_bounds, VirtualBounds};
use super::screenshot_service::{
    ScreenshotPreview, ScreenshotResult, ScreenshotStartPayload, ScreenshotState,
};

#[tauri::command]
pub fn start_screenshot(
    state: State<'_, ScreenshotState>,
) -> Result<ScreenshotStartPayload, String> {
    state.start_screenshot()
}

#[tauri::command]
pub fn cancel_screenshot(
    state: State<'_, ScreenshotState>,
    id: Option<String>,
) -> Result<(), String> {
    state.cancel_screenshot(id)
}

#[tauri::command]
pub fn get_screenshot_result(
    state: State<'_, ScreenshotState>,
    id: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<ScreenshotResult, String> {
    state.get_screenshot_result(id, x, y, width, height)
}

#[tauri::command]
pub fn get_screenshot_preview(
    state: State<'_, ScreenshotState>,
    id: String,
) -> Result<ScreenshotPreview, String> {
    state.get_screenshot_preview(id)
}

#[tauri::command]
pub fn capture_screenshot_native(
    state: State<'_, ScreenshotState>,
) -> Result<ScreenshotResult, String> {
    state.capture_screenshot_native()
}

#[tauri::command]
pub fn get_screenshot_overlay_bounds() -> Result<VirtualBounds, String> {
    let monitors = enumerate_native_monitors()?
        .into_iter()
        .map(|m| m.info)
        .collect::<Vec<_>>();
    virtual_bounds(&monitors)
}
