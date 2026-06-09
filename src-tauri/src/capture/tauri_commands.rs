use tauri::State;

use super::screenshot_service::{ScreenshotResult, ScreenshotState};

#[tauri::command]
pub fn capture_screenshot_native(
    state: State<'_, ScreenshotState>,
) -> Result<ScreenshotResult, String> {
    state.capture_screenshot_native()
}
