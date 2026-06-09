import { ref } from "vue";
import { isTauri } from "../utils/platform";

export interface ScreenshotResult {
  id: string;
  width: number;
  height: number;
  mimeType: string;
  bytes: number[] | Uint8Array;
}

type ScreenshotCompleteHandler = (result: ScreenshotResult) => void;

const _capturing = ref(false);
const _completionHandlers = new Set<ScreenshotCompleteHandler>();

function notifyScreenshotComplete(result: ScreenshotResult) {
  for (const handler of Array.from(_completionHandlers)) {
    handler(result);
  }
}

export function useScreenshot() {
  function onScreenshotComplete(handler: ScreenshotCompleteHandler) {
    _completionHandlers.add(handler);
    return () => _completionHandlers.delete(handler);
  }

  async function triggerScreenshot() {
    if (!isTauri || _capturing.value) return;
    _capturing.value = true;

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<ScreenshotResult>("capture_screenshot_native");
      if (result.bytes?.length) {
        notifyScreenshotComplete(result);
      }
    } catch (e) {
      if (!String(e).toLowerCase().includes("cancelled")) {
        console.error("Screenshot failed:", e);
      }
    } finally {
      _capturing.value = false;
    }
  }

  return {
    capturing: _capturing,
    onScreenshotComplete,
    triggerScreenshot,
  };
}
