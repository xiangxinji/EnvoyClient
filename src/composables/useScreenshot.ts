import { ref } from "vue";
import { isTauri } from "../utils/platform";

export interface ScreenshotMonitor {
  id: number;
  name: string;
  deviceName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
}

export interface ScreenCapture {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  mimeType: string;
  bytes?: number[] | Uint8Array;
  monitors: ScreenshotMonitor[];
}

export interface ScreenshotResult {
  id: string;
  width: number;
  height: number;
  mimeType: string;
  bytes: number[] | Uint8Array;
}

interface ScreenshotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SCREENSHOT_LABEL = "screenshot";
const USE_NATIVE_SCREENSHOT = true;
type ScreenshotCompleteHandler = (result: ScreenshotResult) => void;

const _capturing = ref(false);
const _completionHandlers = new Set<ScreenshotCompleteHandler>();
let _eventsReady = false;
let _pendingCapture: ScreenCapture | null = null;
let _mainWindowVisibleBeforeCapture = true;
let _overlayReady = false;
let _captureDataSent = false;
let _captureStartedAt = 0;
let _captureWatchdog: number | null = null;
let _overlayPrewarm: Promise<void> | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timeout));
  });
}

async function waitForOverlayCreated(overlay: { once: (event: string, handler: (event: unknown) => void) => Promise<unknown> }) {
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      void overlay.once("tauri://created", () => resolve());
      void overlay.once("tauri://error", (event) => reject(event));
    }),
    1500,
    undefined
  );
}

function resetCaptureState() {
  _capturing.value = false;
  _pendingCapture = null;
  _captureDataSent = false;
  _captureStartedAt = 0;
  if (_captureWatchdog !== null) {
    window.clearTimeout(_captureWatchdog);
    _captureWatchdog = null;
  }
}

async function cancelNativeScreenshot(id?: string) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("cancel_screenshot", { id: id ?? null });
  } catch {
    // ignore cleanup failures
  }
}

async function abortStaleCapture() {
  if (!_capturing.value) return;
  const id = _pendingCapture?.id;
  resetCaptureState();
  await cancelNativeScreenshot(id);
  await hideOverlay();
  await restoreMainWindow();
}

async function hideOverlay() {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
    const overlay = await WebviewWindow.getByLabel(SCREENSHOT_LABEL);
    await overlay?.setIgnoreCursorEvents(true).catch(() => undefined);
    const bounds = await getOverlayBounds();
    if (bounds) {
      await overlay?.setPosition(new PhysicalPosition(Math.round(bounds.x), Math.round(bounds.y))).catch(() => undefined);
      await overlay?.setSize(new PhysicalSize(Math.round(bounds.width), Math.round(bounds.height))).catch(() => undefined);
    }
    await resetOverlayVisuals();
  } catch {
    // ignore overlay park failures
  }
}

async function restoreMainWindow() {
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    if (_mainWindowVisibleBeforeCapture) {
      await win.show();
      await win.setFocus();
    }
  } catch {
    // ignore restore failures
  }
}

async function sendPendingCapture() {
  if (!_pendingCapture || _captureDataSent) return;
  const { emitTo } = await import("@tauri-apps/api/event");
  _captureDataSent = true;
  await emitTo(SCREENSHOT_LABEL, "screenshot-data", _pendingCapture);
}

function notifyScreenshotComplete(result: ScreenshotResult) {
  for (const handler of Array.from(_completionHandlers)) {
    handler(result);
  }
}

async function resetOverlayVisuals() {
  try {
    const { emitTo } = await import("@tauri-apps/api/event");
    await emitTo(SCREENSHOT_LABEL, "screenshot-reset");
  } catch {
    // ignore reset failures; screenshot-data will also reset the overlay
  }
}

async function showOverlayInstant() {
  const { invoke } = await import("@tauri-apps/api/core");
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  await invoke("show_screenshot_overlay_instant").catch(async () => {
    const overlay = await WebviewWindow.getByLabel(SCREENSHOT_LABEL);
    await overlay?.show().catch(() => undefined);
  });
}

function handleGlobalScreenshotKeydown(e: KeyboardEvent) {
  if (!_capturing.value || e.key !== "Escape") return;
  e.preventDefault();
  e.stopPropagation();
  void abortStaleCapture();
}

async function ensureMainListeners() {
  if (!isTauri || _eventsReady) return;

  const { listen } = await import("@tauri-apps/api/event");

  await listen("screenshot-ready", async () => {
    _overlayReady = true;
    await sendPendingCapture();
  });

  await listen<{ id?: string } | undefined>("screenshot-overlay-ready", async (event) => {
    if (!_capturing.value || !_pendingCapture) return;
    if (event.payload?.id !== _pendingCapture.id) return;
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const overlay = await WebviewWindow.getByLabel(SCREENSHOT_LABEL);
      await overlay?.setIgnoreCursorEvents(false).catch(() => undefined);
      await showOverlayInstant();
      await overlay?.setFocus();
    } catch {
      // ignore show/focus failures
    }
  });

  await listen<ScreenshotResult>("screenshot-complete", async (event) => {
    resetCaptureState();
    await restoreMainWindow();
    if (event.payload?.bytes?.length) {
      notifyScreenshotComplete(event.payload);
    }
  });

  await listen<{ id?: string } | undefined>("screenshot-cancelled", async (event) => {
    const id = event.payload?.id ?? _pendingCapture?.id;
    resetCaptureState();
    await cancelNativeScreenshot(id);
    await restoreMainWindow();
  });

  window.addEventListener("keydown", handleGlobalScreenshotKeydown, true);
  _eventsReady = true;
}

async function getOrCreateOverlay(bounds?: { x: number; y: number; width: number; height: number }) {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(SCREENSHOT_LABEL);
  if (existing) {
    await existing.setResizable(false).catch(() => undefined);
    await existing.setDecorations(false).catch(() => undefined);
    await existing.setAlwaysOnTop(true).catch(() => undefined);
    await existing.setSkipTaskbar(true).catch(() => undefined);
    await existing.setShadow(false).catch(() => undefined);
    await existing.setIgnoreCursorEvents(true).catch(() => undefined);
    if (bounds) {
      const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
      await existing.setPosition(new PhysicalPosition(Math.round(bounds.x), Math.round(bounds.y)));
      await existing.setSize(new PhysicalSize(Math.round(bounds.width), Math.round(bounds.height)));
    }
    return existing;
  }

  _overlayReady = false;
  const overlay = new WebviewWindow(SCREENSHOT_LABEL, {
    url: "index.html#/screenshot",
    x: bounds?.x ?? -32000,
    y: bounds?.y ?? -32000,
    width: bounds?.width ?? 1,
    height: bounds?.height ?? 1,
    title: "Envoy Screenshot",
    decorations: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focus: false,
    visible: false,
    backgroundColor: [0, 0, 0, 0],
  });

  await waitForOverlayCreated(overlay);

  overlay.setResizable(false).catch(() => undefined);
  overlay.setDecorations(false).catch(() => undefined);
  overlay.setAlwaysOnTop(true).catch(() => undefined);
  overlay.setSkipTaskbar(true).catch(() => undefined);
  overlay.setShadow(false).catch(() => undefined);
  overlay.setIgnoreCursorEvents(true).catch(() => undefined);
  if (bounds) {
    const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
    await overlay.setPosition(new PhysicalPosition(Math.round(bounds.x), Math.round(bounds.y))).catch(() => undefined);
    await overlay.setSize(new PhysicalSize(Math.round(bounds.width), Math.round(bounds.height))).catch(() => undefined);
  }

  overlay.once("tauri://error", async (event) => {
    console.error("Screenshot overlay failed:", event);
    await cancelNativeScreenshot(_pendingCapture?.id);
    resetCaptureState();
    await restoreMainWindow();
  });

  return overlay;
}

async function moveOverlayToBounds(bounds: ScreenshotBounds, show = false, hideBeforeMove = false) {
  const overlay = await getOrCreateOverlay();
  const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
  if (hideBeforeMove) await overlay.hide().catch(() => undefined);
  await overlay.setPosition(new PhysicalPosition(Math.round(bounds.x), Math.round(bounds.y))).catch(() => undefined);
  await overlay.setSize(new PhysicalSize(Math.round(bounds.width), Math.round(bounds.height))).catch(() => undefined);
  await overlay.setAlwaysOnTop(true).catch(() => undefined);
  if (show) {
    await overlay.show().catch(() => undefined);
    await overlay.setFocus().catch(() => undefined);
  }
}

async function getOverlayBoundsFromTauriMonitors(): Promise<ScreenshotBounds | null> {
  const { availableMonitors } = await import("@tauri-apps/api/window");
  const monitors = await availableMonitors().catch(() => []);
  if (!monitors.length) return null;

  const left = Math.min(...monitors.map((m) => m.position.x));
  const top = Math.min(...monitors.map((m) => m.position.y));
  const right = Math.max(...monitors.map((m) => m.position.x + m.size.width));
  const bottom = Math.max(...monitors.map((m) => m.position.y + m.size.height));

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

async function getOverlayBounds(): Promise<ScreenshotBounds | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const bounds = await invoke<ScreenshotBounds>("get_screenshot_overlay_bounds");
    if (bounds?.width && bounds?.height) return bounds;
  } catch {
    // fall back to Tauri monitor metadata
  }
  return getOverlayBoundsFromTauriMonitors();
}

export function useScreenshot() {
  function onScreenshotComplete(handler: ScreenshotCompleteHandler) {
    _completionHandlers.add(handler);
    return () => _completionHandlers.delete(handler);
  }

  async function prewarmScreenshotOverlay() {
    if (!isTauri) return;
    if (!_overlayPrewarm) {
      _overlayPrewarm = (async () => {
        await ensureMainListeners();
        const bounds = await getOverlayBounds();
        await getOrCreateOverlay(bounds ?? undefined);
      })().catch((e) => {
        _overlayPrewarm = null;
        console.warn("Failed to prewarm screenshot overlay:", e);
      });
    }
    await _overlayPrewarm;
  }

  async function triggerScreenshot() {
    if (!isTauri) return;
    if (_capturing.value) {
      const elapsed = Date.now() - _captureStartedAt;
      if (elapsed < 8000) return;
      await abortStaleCapture();
    }
    _capturing.value = true;
    _captureStartedAt = Date.now();
    _pendingCapture = null;
    _captureDataSent = false;
    _captureWatchdog = window.setTimeout(() => {
      void abortStaleCapture();
    }, 12000);

    if (USE_NATIVE_SCREENSHOT) {
      if (_captureWatchdog !== null) {
        window.clearTimeout(_captureWatchdog);
        _captureWatchdog = null;
      }
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<ScreenshotResult>("capture_screenshot_native");
        resetCaptureState();
        if (result.bytes?.length) {
          notifyScreenshotComplete(result);
        }
      } catch (e) {
        resetCaptureState();
        if (!String(e).toLowerCase().includes("cancelled")) {
          console.error("Screenshot failed:", e);
        }
      }
      return;
    }

    await prewarmScreenshotOverlay();

    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const { invoke } = await import("@tauri-apps/api/core");
      const mainWindow = getCurrentWindow();
      _mainWindowVisibleBeforeCapture = await mainWindow.isVisible().catch(() => true);

      const bounds = await getOverlayBounds();
      await getOrCreateOverlay();
      await resetOverlayVisuals();

      const capture = await invoke<ScreenCapture>("start_screenshot");
      _pendingCapture = capture;
      if (bounds) await moveOverlayToBounds(bounds, false);
      await showOverlayInstant();
      if (_overlayReady) await sendPendingCapture();
    } catch (e) {
      console.error("Screenshot failed:", e);
      await cancelNativeScreenshot(_pendingCapture?.id);
      await hideOverlay();
      resetCaptureState();
      await restoreMainWindow();
    }
  }

  return {
    capturing: _capturing,
    onScreenshotComplete,
    prewarmScreenshotOverlay,
    triggerScreenshot,
  };
}
