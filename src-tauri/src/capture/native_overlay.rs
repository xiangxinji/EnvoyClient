use windows::core::w;
use windows::Win32::Foundation::{COLORREF, HINSTANCE, HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, CreateSolidBrush, DeleteObject, EndPaint, FillRect, FrameRect, InvalidateRect,
    PAINTSTRUCT,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    ReleaseCapture, SetCapture, VK_ESCAPE,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetClientRect, GetMessageW,
    GetWindowLongPtrW, LoadCursorW, PostQuitMessage, RegisterClassW, SetLayeredWindowAttributes,
    SetWindowLongPtrW, ShowWindow, TranslateMessage, CS_HREDRAW, CS_VREDRAW, CREATESTRUCTW,
    GWLP_USERDATA, IDC_CROSS, LWA_ALPHA, MSG, SW_SHOW, WM_CREATE, WM_DESTROY, WM_KEYDOWN,
    WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MOUSEMOVE, WM_PAINT, WNDCLASSW, WS_EX_LAYERED,
    WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP,
};

use super::monitor_manager::VirtualBounds;

#[derive(Clone, Copy, Debug)]
pub struct SelectionRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, Default)]
struct Point {
    x: i32,
    y: i32,
}

struct OverlayState {
    start: Point,
    current: Point,
    selecting: bool,
    selected: Option<SelectionRect>,
    cancelled: bool,
}

impl OverlayState {
    fn new() -> Self {
        Self {
            start: Point::default(),
            current: Point::default(),
            selecting: false,
            selected: None,
            cancelled: false,
        }
    }
}

pub fn select_region(bounds: VirtualBounds) -> Result<Option<SelectionRect>, String> {
    if bounds.width == 0 || bounds.height == 0 {
        return Err("Invalid screenshot overlay bounds".to_string());
    }

    let instance = unsafe { GetModuleHandleW(None) }
        .map_err(|e| format!("Failed to get module handle: {}", e))?;
    let class_name = w!("EnvoyNativeScreenshotOverlay");

    let cursor = unsafe { LoadCursorW(None, IDC_CROSS) }
        .map_err(|e| format!("Failed to load crosshair cursor: {}", e))?;
    let wc = WNDCLASSW {
        hCursor: cursor,
        hInstance: HINSTANCE(instance.0),
        lpszClassName: class_name,
        style: CS_HREDRAW | CS_VREDRAW,
        lpfnWndProc: Some(overlay_wnd_proc),
        ..Default::default()
    };
    unsafe {
        RegisterClassW(&wc);
    }

    let mut state = Box::new(OverlayState::new());
    let state_ptr = state.as_mut() as *mut OverlayState;
    let hwnd = unsafe {
        CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_LAYERED,
            class_name,
            w!("Envoy Screenshot Overlay"),
            WS_POPUP,
            bounds.x,
            bounds.y,
            bounds.width as i32,
            bounds.height as i32,
            None,
            None,
            Some(HINSTANCE(instance.0)),
            Some(state_ptr.cast()),
        )
    }
    .map_err(|e| format!("Failed to create native screenshot overlay: {}", e))?;

    unsafe {
        SetLayeredWindowAttributes(hwnd, COLORREF(0), 105, LWA_ALPHA)
            .map_err(|e| format!("Failed to set overlay alpha: {}", e))?;
        let _ = ShowWindow(hwnd, SW_SHOW);
        let _ = InvalidateRect(Some(hwnd), None, true);
    }

    let mut msg = MSG::default();
    loop {
        let result = unsafe { GetMessageW(&mut msg, None, 0, 0) };
        if result.0 == -1 {
            unsafe {
                DestroyWindow(hwnd).ok();
            }
            return Err("Native overlay message loop failed".to_string());
        }
        if result.0 == 0 {
            break;
        }
        unsafe {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }

    if state.cancelled {
        Ok(None)
    } else {
        Ok(state.selected)
    }
}

unsafe extern "system" fn overlay_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_CREATE => {
            let createstruct = lparam.0 as *const CREATESTRUCTW;
            if !createstruct.is_null() {
                let state_ptr = unsafe { (*createstruct).lpCreateParams };
                unsafe {
                    SetWindowLongPtrW(hwnd, GWLP_USERDATA, state_ptr as isize);
                }
            }
            LRESULT(0)
        }
        WM_KEYDOWN => {
            if wparam.0 as u16 == VK_ESCAPE.0 {
                if let Some(state) = state_from_hwnd(hwnd) {
                    state.cancelled = true;
                }
                unsafe {
                    DestroyWindow(hwnd).ok();
                }
                return LRESULT(0);
            }
            unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
        }
        WM_LBUTTONDOWN => {
            if let Some(state) = state_from_hwnd(hwnd) {
                let point = point_from_lparam(lparam);
                state.start = point;
                state.current = point;
                state.selecting = true;
                state.selected = None;
                unsafe {
                    SetCapture(hwnd);
                    let _ = InvalidateRect(Some(hwnd), None, true);
                }
            }
            LRESULT(0)
        }
        WM_MOUSEMOVE => {
            if let Some(state) = state_from_hwnd(hwnd) {
                if state.selecting {
                    state.current = point_from_lparam(lparam);
                    unsafe {
                        let _ = InvalidateRect(Some(hwnd), None, true);
                    }
                }
            }
            LRESULT(0)
        }
        WM_LBUTTONUP => {
            if let Some(state) = state_from_hwnd(hwnd) {
                if state.selecting {
                    state.selecting = false;
                    state.current = point_from_lparam(lparam);
                    unsafe {
                        ReleaseCapture().ok();
                    }
                    let rect = normalized_rect(state.start, state.current);
                    if rect.width >= 5 && rect.height >= 5 {
                        state.selected = Some(rect);
                        unsafe {
                            DestroyWindow(hwnd).ok();
                        }
                    } else {
                        state.selected = None;
                        unsafe {
                            let _ = InvalidateRect(Some(hwnd), None, true);
                        }
                    }
                }
            }
            LRESULT(0)
        }
        WM_PAINT => {
            paint_overlay(hwnd);
            LRESULT(0)
        }
        WM_DESTROY => {
            unsafe {
                PostQuitMessage(0);
            }
            LRESULT(0)
        }
        _ => unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) },
    }
}

fn state_from_hwnd(hwnd: HWND) -> Option<&'static mut OverlayState> {
    let ptr = unsafe { GetWindowLongPtrW(hwnd, GWLP_USERDATA) } as *mut OverlayState;
    if ptr.is_null() {
        None
    } else {
        Some(unsafe { &mut *ptr })
    }
}

fn point_from_lparam(lparam: LPARAM) -> Point {
    let value = lparam.0 as u32;
    Point {
        x: (value & 0xffff) as i16 as i32,
        y: ((value >> 16) & 0xffff) as i16 as i32,
    }
}

fn normalized_rect(a: Point, b: Point) -> SelectionRect {
    let left = a.x.min(b.x).max(0) as u32;
    let top = a.y.min(b.y).max(0) as u32;
    let right = a.x.max(b.x).max(0) as u32;
    let bottom = a.y.max(b.y).max(0) as u32;
    SelectionRect {
        x: left,
        y: top,
        width: right.saturating_sub(left),
        height: bottom.saturating_sub(top),
    }
}

fn paint_overlay(hwnd: HWND) {
    let mut ps = PAINTSTRUCT::default();
    let hdc = unsafe { BeginPaint(hwnd, &mut ps) };
    if hdc.is_invalid() {
        return;
    }

    let mut client = RECT::default();
    unsafe {
        let _ = GetClientRect(hwnd, &mut client);
    }

    let dim_brush = unsafe { CreateSolidBrush(COLORREF(0x00000000)) };
    if !dim_brush.is_invalid() {
        unsafe {
            FillRect(hdc, &client, dim_brush);
            let _ = DeleteObject(dim_brush.into()).ok();
        }
    }

    if let Some(state) = state_from_hwnd(hwnd) {
        if state.selecting {
            let selection = normalized_rect(state.start, state.current);
            if selection.width > 0 && selection.height > 0 {
                let rect = RECT {
                    left: selection.x as i32,
                    top: selection.y as i32,
                    right: selection.x as i32 + selection.width as i32,
                    bottom: selection.y as i32 + selection.height as i32,
                };
                let brush = unsafe { CreateSolidBrush(COLORREF(0x005ec522)) };
                if !brush.is_invalid() {
                    unsafe {
                        FrameRect(hdc, &rect, brush);
                        let _ = DeleteObject(brush.into()).ok();
                    }
                }
            }
        }
    }

    unsafe {
        let _ = EndPaint(hwnd, &ps).ok();
    }
}
