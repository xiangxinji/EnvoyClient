use serde::Serialize;
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, HMONITOR, MONITORINFO};
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};
use windows_capture::monitor::Monitor;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotMonitor {
    pub id: usize,
    pub name: String,
    pub device_name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VirtualBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug)]
pub struct NativeMonitor {
    pub info: ScreenshotMonitor,
    pub monitor: Monitor,
}

fn monitor_rect(monitor: Monitor) -> Result<(i32, i32, u32, u32, bool), String> {
    let mut info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..MONITORINFO::default()
    };

    let ok = unsafe {
        GetMonitorInfoW(
            HMONITOR(monitor.as_raw_hmonitor()),
            (&raw mut info).cast::<MONITORINFO>(),
        )
    };
    if !ok.as_bool() {
        return Err("Failed to query monitor bounds".to_string());
    }

    let width = (info.rcMonitor.right - info.rcMonitor.left).max(0) as u32;
    let height = (info.rcMonitor.bottom - info.rcMonitor.top).max(0) as u32;
    Ok((
        info.rcMonitor.left,
        info.rcMonitor.top,
        width,
        height,
        info.dwFlags & 1 == 1,
    ))
}

fn monitor_scale_factor(monitor: Monitor) -> f64 {
    let mut dpi_x = 96u32;
    let mut dpi_y = 96u32;
    let result = unsafe {
        GetDpiForMonitor(
            HMONITOR(monitor.as_raw_hmonitor()),
            MDT_EFFECTIVE_DPI,
            &mut dpi_x,
            &mut dpi_y,
        )
    };
    if result.is_err() {
        return 1.0;
    }

    (dpi_x.max(dpi_y) as f64 / 96.0).max(1.0)
}

pub fn enumerate_native_monitors() -> Result<Vec<NativeMonitor>, String> {
    let monitors = Monitor::enumerate().map_err(|e| e.to_string())?;
    let mut result = Vec::with_capacity(monitors.len());

    for monitor in monitors {
        let id = monitor.index().map_err(|e| e.to_string())?;
        let (x, y, rect_width, rect_height, is_primary) = monitor_rect(monitor)?;
        let width = monitor.width().unwrap_or(rect_width).max(rect_width);
        let height = monitor.height().unwrap_or(rect_height).max(rect_height);
        let device_name = monitor
            .device_name()
            .unwrap_or_else(|_| format!("DISPLAY{}", id));
        let name = monitor.name().unwrap_or_else(|_| device_name.clone());

        result.push(NativeMonitor {
            info: ScreenshotMonitor {
                id,
                name,
                device_name,
                x,
                y,
                width,
                height,
                scale_factor: monitor_scale_factor(monitor),
                is_primary,
            },
            monitor,
        });
    }

    result.sort_by_key(|m| m.info.id);
    Ok(result)
}

pub fn virtual_bounds(monitors: &[ScreenshotMonitor]) -> Result<VirtualBounds, String> {
    if monitors.is_empty() {
        return Err("No monitor found".to_string());
    }

    let left = monitors.iter().map(|m| m.x).min().unwrap_or(0);
    let top = monitors.iter().map(|m| m.y).min().unwrap_or(0);
    let right = monitors
        .iter()
        .map(|m| m.x.saturating_add(m.width as i32))
        .max()
        .unwrap_or(left);
    let bottom = monitors
        .iter()
        .map(|m| m.y.saturating_add(m.height as i32))
        .max()
        .unwrap_or(top);

    Ok(VirtualBounds {
        x: left,
        y: top,
        width: (right - left).max(0) as u32,
        height: (bottom - top).max(0) as u32,
    })
}
