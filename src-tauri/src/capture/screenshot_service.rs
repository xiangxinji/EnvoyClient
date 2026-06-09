use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

use image::{ImageEncoder as _, RgbaImage};
use serde::Serialize;
use windows_capture::dxgi_duplication_api::{
    DxgiDuplicationApi, DxgiDuplicationFormat, Error as DxgiError,
};

use super::monitor_manager::{
    enumerate_native_monitors, virtual_bounds, NativeMonitor, ScreenshotMonitor, VirtualBounds,
};
use super::native_overlay;

#[derive(Clone, Debug)]
struct MonitorFrame {
    monitor: ScreenshotMonitor,
    width: u32,
    height: u32,
    bgra: Arc<Vec<u8>>,
}

#[derive(Clone, Debug)]
struct VirtualFrame {
    id: String,
    bounds: VirtualBounds,
    monitors: Vec<ScreenshotMonitor>,
    frames: Vec<MonitorFrame>,
    width: u32,
    height: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotStartPayload {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub mime_type: String,
    pub monitors: Vec<ScreenshotMonitor>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotResult {
    pub id: String,
    pub width: u32,
    pub height: u32,
    pub mime_type: String,
    pub bytes: Vec<u8>,
}

pub struct ScreenshotState {
    service: Arc<Mutex<ScreenshotService>>,
    background_started: AtomicBool,
}

impl ScreenshotState {
    pub fn new() -> Self {
        Self {
            service: Arc::new(Mutex::new(ScreenshotService::new())),
            background_started: AtomicBool::new(false),
        }
    }

    pub fn start_background_capture(&self) {
        if self.background_started.swap(true, Ordering::AcqRel) {
            return;
        }

        let service = Arc::clone(&self.service);
        thread::spawn(move || loop {
            if let Ok(mut service) = service.try_lock() {
                let _ = service.refresh_latest_frames();
            }
            thread::sleep(Duration::from_millis(120));
        });
    }

    pub fn warm_up(&self) -> Result<(), String> {
        self.service
            .lock()
            .map_err(|_| "Screenshot service lock poisoned".to_string())?
            .warm_up()
    }

    pub fn start_screenshot(&self) -> Result<ScreenshotStartPayload, String> {
        self.service
            .lock()
            .map_err(|_| "Screenshot service lock poisoned".to_string())?
            .start_screenshot()
    }

    pub fn cancel_screenshot(&self, id: Option<String>) -> Result<(), String> {
        self.service
            .lock()
            .map_err(|_| "Screenshot service lock poisoned".to_string())?
            .cancel_screenshot(id);
        Ok(())
    }

    pub fn get_screenshot_result(
        &self,
        id: String,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> Result<ScreenshotResult, String> {
        self.service
            .lock()
            .map_err(|_| "Screenshot service lock poisoned".to_string())?
            .get_screenshot_result(id, x, y, width, height)
    }

    pub fn capture_screenshot_native(&self) -> Result<ScreenshotResult, String> {
        let payload = self.start_screenshot()?;
        let selection_bounds = VirtualBounds {
            x: payload.x,
            y: payload.y,
            width: payload.width,
            height: payload.height,
        };

        match native_overlay::select_region(selection_bounds)? {
            Some(rect) => self.get_screenshot_result(
                payload.id,
                rect.x,
                rect.y,
                rect.width,
                rect.height,
            ),
            None => {
                self.cancel_screenshot(Some(payload.id))?;
                Err("Screenshot cancelled".to_string())
            }
        }
    }
}

struct ScreenshotService {
    sessions: HashMap<usize, DxgiDuplicationApi>,
    latest_frames: HashMap<usize, MonitorFrame>,
    active_frames: HashMap<String, VirtualFrame>,
    sequence: u64,
}

impl ScreenshotService {
    fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            latest_frames: HashMap::new(),
            active_frames: HashMap::new(),
            sequence: 0,
        }
    }

    fn warm_up(&mut self) -> Result<(), String> {
        let monitors = enumerate_native_monitors()?;
        for monitor in monitors {
            self.ensure_session(&monitor)?;
        }
        let _ = self.refresh_latest_frames();
        Ok(())
    }

    fn start_screenshot(&mut self) -> Result<ScreenshotStartPayload, String> {
        let virtual_frame = self.latest_virtual_frame()?;
        let payload = ScreenshotStartPayload {
            id: virtual_frame.id.clone(),
            x: virtual_frame.bounds.x,
            y: virtual_frame.bounds.y,
            width: virtual_frame.width,
            height: virtual_frame.height,
            mime_type: "image/png".to_string(),
            monitors: virtual_frame.monitors.clone(),
        };

        self.active_frames
            .insert(virtual_frame.id.clone(), virtual_frame);
        Ok(payload)
    }

    fn cancel_screenshot(&mut self, id: Option<String>) {
        if let Some(id) = id {
            self.active_frames.remove(&id);
        } else {
            self.active_frames.clear();
        }
    }

    fn get_screenshot_result(
        &mut self,
        id: String,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> Result<ScreenshotResult, String> {
        if width == 0 || height == 0 {
            return Err("Invalid crop size".to_string());
        }

        let frame = self
            .active_frames
            .remove(&id)
            .ok_or_else(|| "Screenshot session expired".to_string())?;
        let crop = crop_virtual_bgra(&frame, x, y, width, height)?;
        let rgba = bgra_to_rgba(&crop.bgra, crop.width, crop.height)?;
        let image = RgbaImage::from_raw(crop.width, crop.height, rgba)
            .ok_or_else(|| "Failed to create clipboard image".to_string())?;
        crate::copy_rgba_to_clipboard(&image)?;
        let bytes = encode_bgra_png(&crop.bgra, crop.width, crop.height)?;

        Ok(ScreenshotResult {
            id,
            width: crop.width,
            height: crop.height,
            mime_type: "image/png".to_string(),
            bytes,
        })
    }

    fn refresh_latest_frames(&mut self) -> Result<(), String> {
        let native_monitors = enumerate_native_monitors()?;
        for native in native_monitors {
            let _ = self.capture_monitor_frame(&native);
        }
        Ok(())
    }

    fn latest_virtual_frame(&mut self) -> Result<VirtualFrame, String> {
        let native_monitors = enumerate_native_monitors()?;
        if native_monitors.is_empty() {
            return Err("No monitor found".to_string());
        }

        let monitor_infos = native_monitors
            .iter()
            .map(|m| m.info.clone())
            .collect::<Vec<_>>();
        let bounds = virtual_bounds(&monitor_infos)?;
        let mut frames = Vec::with_capacity(native_monitors.len());
        for native in &native_monitors {
            if let Some(frame) = self.latest_frames.get(&native.info.id).cloned() {
                frames.push(frame);
            } else {
                frames.push(self.capture_monitor_frame(native)?);
            }
        }

        Ok(VirtualFrame {
            id: self.next_id(),
            bounds,
            monitors: monitor_infos,
            frames,
            width: bounds.width,
            height: bounds.height,
        })
    }

    fn capture_monitor_frame(&mut self, native: &NativeMonitor) -> Result<MonitorFrame, String> {
        self.ensure_session(native)?;

        let timeout_ms = if self.latest_frames.contains_key(&native.info.id) {
            0
        } else {
            80
        };

        for _ in 0..3 {
            let session = self
                .sessions
                .get_mut(&native.info.id)
                .ok_or_else(|| "DXGI session missing".to_string())?;

            match session.acquire_next_frame(timeout_ms) {
                Ok(mut frame) => {
                    let width = frame.width();
                    let height = frame.height();
                    let buffer = frame.buffer().map_err(|e| e.to_string())?;
                    let format = buffer.format();
                    let mut compact = Vec::new();
                    let raw = buffer.as_nopadding_buffer(&mut compact);
                    let bgra = normalize_to_bgra(raw, width, height, format)?;
                    let frame = MonitorFrame {
                        monitor: native.info.clone(),
                        width,
                        height,
                        bgra: Arc::new(bgra),
                    };
                    self.latest_frames.insert(native.info.id, frame.clone());
                    return Ok(frame);
                }
                Err(DxgiError::Timeout) => {
                    if let Some(frame) = self.latest_frames.get(&native.info.id) {
                        return Ok(frame.clone());
                    }
                }
                Err(DxgiError::AccessLost) => {
                    self.sessions.remove(&native.info.id);
                    self.ensure_session(native)?;
                }
                Err(err) => return Err(err.to_string()),
            }
        }

        self.latest_frames
            .get(&native.info.id)
            .cloned()
            .ok_or_else(|| format!("No frame available for monitor {}", native.info.id))
    }

    fn ensure_session(&mut self, native: &NativeMonitor) -> Result<(), String> {
        if self.sessions.contains_key(&native.info.id) {
            return Ok(());
        }

        let session =
            DxgiDuplicationApi::new_options(native.monitor, &[DxgiDuplicationFormat::Bgra8])
                .map_err(|e| e.to_string())?;
        self.sessions.insert(native.info.id, session);
        Ok(())
    }

    fn next_id(&mut self) -> String {
        self.sequence = self.sequence.wrapping_add(1);
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        format!("screenshot-{}-{}", millis, self.sequence)
    }
}

struct CroppedBgra {
    width: u32,
    height: u32,
    bgra: Vec<u8>,
}

fn encode_bgra_png(bgra: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let rgba = bgra_to_rgba(bgra, width, height)?;
    let mut png = Vec::new();
    image::codecs::png::PngEncoder::new_with_quality(
        &mut png,
        image::codecs::png::CompressionType::Fast,
        image::codecs::png::FilterType::NoFilter,
    )
    .write_image(&rgba, width, height, image::ExtendedColorType::Rgba8)
    .map_err(|e| e.to_string())?;
    Ok(png)
}

fn normalize_to_bgra(
    raw: &[u8],
    width: u32,
    height: u32,
    format: DxgiDuplicationFormat,
) -> Result<Vec<u8>, String> {
    let expected = width as usize * height as usize * 4;
    if raw.len() < expected {
        return Err("Frame buffer is smaller than expected".to_string());
    }

    match format {
        DxgiDuplicationFormat::Bgra8 | DxgiDuplicationFormat::Bgra8Srgb => {
            Ok(raw[..expected].to_vec())
        }
        DxgiDuplicationFormat::Rgba8 | DxgiDuplicationFormat::Rgba8Srgb => {
            let mut bgra = raw[..expected].to_vec();
            for px in bgra.chunks_exact_mut(4) {
                px.swap(0, 2);
            }
            Ok(bgra)
        }
        _ => Err(format!("Unsupported DXGI frame format: {:?}", format)),
    }
}

fn crop_virtual_bgra(
    frame: &VirtualFrame,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<CroppedBgra, String> {
    let x = x.min(frame.width.saturating_sub(1));
    let y = y.min(frame.height.saturating_sub(1));
    let width = width.min(frame.width.saturating_sub(x));
    let height = height.min(frame.height.saturating_sub(y));
    if width == 0 || height == 0 {
        return Err("Invalid crop bounds".to_string());
    }

    let mut bgra = vec![0u8; width as usize * height as usize * 4];
    let dest_stride = width as usize * 4;

    let crop_left = x as i64;
    let crop_top = y as i64;
    let crop_right = x as i64 + width as i64;
    let crop_bottom = y as i64 + height as i64;

    for monitor_frame in &frame.frames {
        let frame_left = monitor_frame.monitor.x as i64 - frame.bounds.x as i64;
        let frame_top = monitor_frame.monitor.y as i64 - frame.bounds.y as i64;
        let frame_right = frame_left + monitor_frame.width as i64;
        let frame_bottom = frame_top + monitor_frame.height as i64;

        let left = crop_left.max(frame_left);
        let top = crop_top.max(frame_top);
        let right = crop_right.min(frame_right);
        let bottom = crop_bottom.min(frame_bottom);
        if left >= right || top >= bottom {
            continue;
        }

        let copy_width = (right - left) as usize;
        let copy_height = (bottom - top) as usize;
        let source_x = (left - frame_left) as usize;
        let source_y = (top - frame_top) as usize;
        let dest_x = (left - crop_left) as usize;
        let dest_y = (top - crop_top) as usize;
        let source_stride = monitor_frame.width as usize * 4;

        for row in 0..copy_height {
            let source_offset = (source_y + row) * source_stride + source_x * 4;
            let dest_offset = (dest_y + row) * dest_stride + dest_x * 4;
            let bytes = copy_width * 4;
            bgra[dest_offset..dest_offset + bytes]
                .copy_from_slice(&monitor_frame.bgra[source_offset..source_offset + bytes]);
        }
    }

    Ok(CroppedBgra {
        width,
        height,
        bgra,
    })
}

fn bgra_to_rgba(bgra: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let expected = width as usize * height as usize * 4;
    if bgra.len() < expected {
        return Err("BGRA buffer is smaller than expected".to_string());
    }

    let mut rgba = bgra[..expected].to_vec();
    for px in rgba.chunks_exact_mut(4) {
        px.swap(0, 2);
        px[3] = 255;
    }
    Ok(rgba)
}
