import { ref } from "vue";
import { isTauri, safeInvoke } from "../utils/platform";

export interface ScreenshotMonitor {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
}

export interface ScreenshotWindow {
  id: number;
  title: string;
  appName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

export interface ScreenCapture {
  data: string;
  captureId?: string;
  rgba?: string;
  imagePath?: string;
  width: number;
  height: number;
  monitor: ScreenshotMonitor;
  windows: ScreenshotWindow[];
}

type NativeScreenCapture = Omit<ScreenCapture, "data"> & {
  data?: string;
  rgba?: string;
  imagePath?: string;
};

const SCREENSHOT_LABEL = "screenshot";

const _capturing = ref(false);
const _captureTarget = ref<((file: File) => void) | null>(null);
let _eventsReady = false;
let _pendingCapture: ScreenCapture | null = null;
let _mainWindowVisibleBeforeCapture = true;
let _overlayReady = false;
let _captureDataSent = false;
let _captureStartedAt = 0;
let _captureWatchdog: number | null = null;

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

async function abortStaleCapture() {
  if (!_capturing.value) return;
  resetCaptureState();
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const overlay = await WebviewWindow.getByLabel(SCREENSHOT_LABEL);
    await overlay?.hide();
  } catch {
    // ignore stale overlay cleanup failures
  }
  await restoreMainWindow();
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

async function ensureMainListeners() {
  if (!isTauri || _eventsReady) return;
  _eventsReady = true;

  const { listen, emitTo } = await import("@tauri-apps/api/event");

  await listen("screenshot-ready", async () => {
    _overlayReady = true;
    if (_pendingCapture && !_captureDataSent) {
      _captureDataSent = true;
      await emitTo(SCREENSHOT_LABEL, "screenshot-data", _pendingCapture);
    }
  });

  await listen("screenshot-overlay-ready", async () => {
    if (!_capturing.value) return;
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const overlay = await WebviewWindow.getByLabel(SCREENSHOT_LABEL);
      await overlay?.show();
      await overlay?.setFocus();
    } catch {
      // ignore show/focus failures; cancellation still restores state
    }
  });

  await listen("screenshot-complete", async () => {
    resetCaptureState();
    await restoreMainWindow();
  });

  await listen("screenshot-cancelled", async () => {
    resetCaptureState();
    await restoreMainWindow();
  });
}

async function getOrCreateOverlay(bounds?: { x: number; y: number; width: number; height: number }) {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(SCREENSHOT_LABEL);
  if (existing) {
    if (bounds) {
      const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");
      await existing.setPosition(new LogicalPosition(bounds.x, bounds.y));
      await existing.setSize(new LogicalSize(bounds.width, bounds.height));
    }
    return existing;
  }

  _overlayReady = false;
  const overlay = new WebviewWindow(SCREENSHOT_LABEL, {
    url: "index.html#/screenshot",
    x: bounds?.x ?? -32000,
    y: bounds?.y ?? -32000,
    width: bounds?.width ?? 32,
    height: bounds?.height ?? 32,
    title: "Envoy Screenshot",
    decorations: false,
    transparent: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focus: false,
    visible: false,
  });

  overlay.once("tauri://error", async (event) => {
    console.error("Screenshot overlay failed:", event);
    resetCaptureState();
    await restoreMainWindow();
  });

  return overlay;
}

async function prepareOverlayNearCursor() {
  const { cursorPosition, monitorFromPoint, primaryMonitor } = await import("@tauri-apps/api/window");
  const cursor = await cursorPosition().catch(() => null);
  const monitor = cursor
    ? await monitorFromPoint(cursor.x, cursor.y).catch(() => null)
    : await primaryMonitor().catch(() => null);

  if (!monitor) {
    await getOrCreateOverlay();
    return;
  }

  const scale = monitor.scaleFactor || 1;
  await getOrCreateOverlay({
    x: monitor.position.x / scale,
    y: monitor.position.y / scale,
    width: monitor.size.width / scale,
    height: monitor.size.height / scale,
  });
}

export function useScreenshot() {
  function setScreenshotTarget(callback: ((file: File) => void) | null) {
    _captureTarget.value = callback;
  }

  async function prewarmScreenshotOverlay() {
    if (!isTauri) return;
    await ensureMainListeners();
    await getOrCreateOverlay().catch((e) => console.warn("Failed to prewarm screenshot overlay:", e));
  }

  async function triggerScreenshot(callback?: (file: File) => void) {
    if (!isTauri) return;
    if (_capturing.value) {
      const elapsed = Date.now() - _captureStartedAt;
      if (elapsed < 8000) return;
      await abortStaleCapture();
    }
    if (callback) _captureTarget.value = callback;

    _capturing.value = true;
    _captureStartedAt = Date.now();
    _pendingCapture = null;
    _captureDataSent = false;
    _captureWatchdog = window.setTimeout(() => {
      void abortStaleCapture();
    }, 12000);
    await ensureMainListeners();

    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");

      const mainWindow = getCurrentWindow();
      _mainWindowVisibleBeforeCapture = await mainWindow.isVisible().catch(() => true);

      const overlayPromise = prepareOverlayNearCursor().catch((e) => {
        console.warn("Failed to prepare screenshot overlay:", e);
      });
      const resultPromise = safeInvoke<NativeScreenCapture>("capture_screens", {});
      const result = await resultPromise;
      if (!result) throw new Error("No screenshot data returned");

      let data = result.data;
      if (!data && !result.rgba && result.imagePath) {
        const { convertFileSrc } = await import("@tauri-apps/api/core");
        data = convertFileSrc(result.imagePath);
      }
      if (!data && !result.rgba) throw new Error("No screenshot image returned");

      _pendingCapture = { ...result, data: data || "" };
      const monitor = result.monitor;
      const scale = monitor.scaleFactor || 1;

      await overlayPromise;
      await getOrCreateOverlay({
        x: monitor.x / scale,
        y: monitor.y / scale,
        width: monitor.width / scale,
        height: monitor.height / scale,
      });

      if (_overlayReady && !_captureDataSent) {
        const { emitTo } = await import("@tauri-apps/api/event");
        _captureDataSent = true;
        await emitTo(SCREENSHOT_LABEL, "screenshot-data", _pendingCapture);
      }
    } catch (e) {
      console.error("Screenshot failed:", e);
      resetCaptureState();
      await restoreMainWindow();
    }
  }

  return {
    capturing: _capturing,
    prewarmScreenshotOverlay,
    setScreenshotTarget,
    triggerScreenshot,
  };
}
