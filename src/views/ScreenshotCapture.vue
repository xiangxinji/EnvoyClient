<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Event } from "@tauri-apps/api/event";
import type { ScreenCapture, ScreenshotWindow } from "../composables/useScreenshot";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
const capture = ref<ScreenCapture | null>(null);
const selectedRect = ref<Rect | null>(null);
const hoverRect = ref<Rect | null>(null);
const selecting = ref(false);
const copyError = ref("");

let image: HTMLImageElement | null = null;
let sourceCanvas: HTMLCanvasElement | null = null;
let startPoint = { x: 0, y: 0 };
let currentPoint = { x: 0, y: 0 };
let pressedHoverRect: Rect | null = null;
let unlistenData: (() => void) | null = null;

const scale = computed(() => capture.value?.monitor.scaleFactor || window.devicePixelRatio || 1);
const toolbarStyle = computed(() => {
  if (!selectedRect.value || !capture.value) return {};
  const rect = selectedRect.value;
  const s = scale.value;
  const cssX = rect.x / s;
  const cssY = rect.y / s;
  const cssW = rect.width / s;
  const cssH = rect.height / s;
  const below = cssY + cssH + 44 < window.innerHeight;
  return {
    left: `${Math.min(Math.max(cssX + cssW, 92), window.innerWidth - 92)}px`,
    top: `${below ? cssY + cssH + 10 : Math.max(10, cssY - 42)}px`,
  };
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pointFromMouse(e: MouseEvent) {
  const data = capture.value;
  const s = scale.value;
  return {
    x: clamp(Math.round(e.clientX * s), 0, data?.width ?? 0),
    y: clamp(Math.round(e.clientY * s), 0, data?.height ?? 0),
  };
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function clipWindowToMonitor(win: ScreenshotWindow): Rect | null {
  const data = capture.value;
  if (!data) return null;
  const monitor = data.monitor;
  const x = Math.max(win.x, monitor.x) - monitor.x;
  const y = Math.max(win.y, monitor.y) - monitor.y;
  const right = Math.min(win.x + win.width, monitor.x + monitor.width) - monitor.x;
  const bottom = Math.min(win.y + win.height, monitor.y + monitor.height) - monitor.y;
  const width = right - x;
  const height = bottom - y;
  if (width < 16 || height < 16) return null;
  return { x, y, width, height };
}

function rectContains(rect: Rect, point: { x: number; y: number }) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function findHoverRect(point: { x: number; y: number }) {
  const data = capture.value;
  if (!data) return null;
  for (const win of data.windows) {
    const rect = clipWindowToMonitor(win);
    if (rect && rectContains(rect, point)) return rect;
  }
  return null;
}

function drawRect(ctx: CanvasRenderingContext2D, rect: Rect, color = "#16a34a") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(rect.x + 1, rect.y + 1, Math.max(0, rect.width - 2), Math.max(0, rect.height - 2));
  ctx.restore();
}

function drawSizeLabel(ctx: CanvasRenderingContext2D, rect: Rect) {
  const label = `${Math.round(rect.width)} x ${Math.round(rect.height)}`;
  ctx.save();
  ctx.font = `${Math.round(12 * scale.value)}px system-ui, sans-serif`;
  const metrics = ctx.measureText(label);
  const paddingX = 6 * scale.value;
  const labelH = 22 * scale.value;
  const labelW = metrics.width + paddingX * 2;
  const labelX = rect.x;
  const labelY = rect.y > labelH + 6 ? rect.y - labelH - 6 : rect.y + rect.height + 6;
  ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
  ctx.fillRect(labelX, labelY, labelW, labelH);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, labelX + paddingX, labelY + 15 * scale.value);
  ctx.restore();
}

function draw() {
  const canvas = canvasRef.value;
  const data = capture.value;
  const source = sourceCanvas || image;
  if (!canvas || !source || !data) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = data.width;
  canvas.height = data.height;
  ctx.clearRect(0, 0, data.width, data.height);
  ctx.drawImage(source, 0, 0, data.width, data.height);
  ctx.fillStyle = "rgba(0, 0, 0, 0.46)";
  ctx.fillRect(0, 0, data.width, data.height);

  const activeRect = selectedRect.value || (selecting.value ? normalizeRect(startPoint, currentPoint) : hoverRect.value);
  if (!activeRect || activeRect.width <= 0 || activeRect.height <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(activeRect.x, activeRect.y, activeRect.width, activeRect.height);
  ctx.clip();
  ctx.drawImage(source, 0, 0, data.width, data.height);
  ctx.restore();

  drawRect(ctx, activeRect, selectedRect.value || selecting.value ? "#22c55e" : "#38bdf8");
  if (selectedRect.value || selecting.value) drawSizeLabel(ctx, activeRect);
}

function rgbaBase64ToCanvas(rgba: string, width: number, height: number) {
  const binary = atob(rgba);
  const bytes = new Uint8ClampedArray(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.putImageData(new ImageData(bytes, width, height), 0, 0);
  return canvas;
}

function notifyOverlayReady() {
  draw();
  requestAnimationFrame(() => {
    emitTo("main", "screenshot-overlay-ready");
  });
}

async function handleData(event: Event<ScreenCapture>) {
  capture.value = event.payload;
  selectedRect.value = null;
  hoverRect.value = null;
  selecting.value = false;
  copyError.value = "";
  image = null;
  sourceCanvas = null;

  await nextTick();
  if (event.payload.rgba) {
    try {
      sourceCanvas = rgbaBase64ToCanvas(event.payload.rgba, event.payload.width, event.payload.height);
      notifyOverlayReady();
      return;
    } catch (e) {
      console.error("Failed to render raw screenshot:", e);
    }
  }

  image = new Image();
  let fallbackTried = false;
  image.onload = () => {
    notifyOverlayReady();
  };
  image.onerror = async () => {
    if (event.payload.imagePath && image && !fallbackTried) {
      fallbackTried = true;
      try {
        image.src = await invoke<string>("screenshot_file_data_url", { imagePath: event.payload.imagePath });
        return;
      } catch (e) {
        console.error("Failed to load screenshot fallback data:", e);
      }
    }
    await emitTo("main", "screenshot-cancelled");
    await closeOverlay();
  };
  image.src = event.payload.data;
}

function onMouseMove(e: MouseEvent) {
  e.preventDefault();
  const point = pointFromMouse(e);
  currentPoint = point;
  if (selecting.value) {
    selectedRect.value = null;
  } else {
    hoverRect.value = findHoverRect(point);
  }
  draw();
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const point = pointFromMouse(e);
  startPoint = point;
  currentPoint = point;
  pressedHoverRect = hoverRect.value;
  selecting.value = true;
  selectedRect.value = null;
  draw();
}

function onMouseUp(e: MouseEvent) {
  e.preventDefault();
  if (!selecting.value) return;
  selecting.value = false;
  currentPoint = pointFromMouse(e);

  const dragRect = normalizeRect(startPoint, currentPoint);
  const moved = Math.max(dragRect.width, dragRect.height);
  const rect = moved < 5 * scale.value && pressedHoverRect ? pressedHoverRect : dragRect;
  pressedHoverRect = null;

  if (rect.width < 5 * scale.value || rect.height < 5 * scale.value) {
    selectedRect.value = null;
    draw();
    return;
  }

  selectedRect.value = rect;
  draw();
}

function preventNativeDrag(e: globalThis.Event) {
  e.preventDefault();
}

async function closeOverlay() {
  await getCurrentWindow().hide();
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, raw] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function copyDataUrlToClipboard(dataUrl: string) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard image write is not supported");
  }

  const blob = dataUrlToBlob(dataUrl);
  await navigator.clipboard.write([
    new ClipboardItem({ [blob.type]: blob }),
  ]);
}

async function cancel() {
  await emitTo("main", "screenshot-cancelled");
  await closeOverlay();
}

async function confirm() {
  const data = capture.value;
  const rect = selectedRect.value;
  const source = sourceCanvas || image;
  if (!data || !source || !rect) return;

  copyError.value = "";

  try {
    let dataUrl: string;
    if (data.captureId) {
      const cropped = await invoke<{ data: string; name: string }>("crop_cached_screenshot", {
        captureId: data.captureId,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      dataUrl = cropped.data;
    } else if (data.imagePath) {
      const cropped = await invoke<{ data: string; name: string }>("crop_screenshot", {
        imagePath: data.imagePath,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      dataUrl = cropped.data;
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(
        source,
        Math.round(rect.x),
        Math.round(rect.y),
        Math.round(rect.width),
        Math.round(rect.height),
        0,
        0,
        canvas.width,
        canvas.height,
      );
      dataUrl = canvas.toDataURL("image/png");
    }

    await copyDataUrlToClipboard(dataUrl);
    await emitTo("main", "screenshot-complete");
    await closeOverlay();
  } catch (e) {
    console.error("Failed to copy screenshot:", e);
    copyError.value = "复制失败，请重试";
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    cancel();
  } else if (e.key === "Enter" && selectedRect.value) {
    e.preventDefault();
    confirm();
  }
}

onMounted(async () => {
  const win = getCurrentWindow();
  await win.setAlwaysOnTop(true).catch(() => undefined);
  await win.setCursorIcon("crosshair").catch(() => undefined);
  unlistenData = await win.listen<ScreenCapture>("screenshot-data", handleData);
  window.addEventListener("keydown", onKeydown, true);
  window.addEventListener("dragstart", preventNativeDrag, true);
  window.addEventListener("selectstart", preventNativeDrag, true);
  window.addEventListener("contextmenu", preventNativeDrag, true);
  await emitTo("main", "screenshot-ready");
});

onBeforeUnmount(() => {
  unlistenData?.();
  window.removeEventListener("keydown", onKeydown, true);
  window.removeEventListener("dragstart", preventNativeDrag, true);
  window.removeEventListener("selectstart", preventNativeDrag, true);
  window.removeEventListener("contextmenu", preventNativeDrag, true);
  image = null;
  sourceCanvas = null;
});
</script>

<template>
  <div class="screenshot-capture">
    <canvas
      ref="canvasRef"
      class="screenshot-canvas"
      draggable="false"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @dragstart.prevent
      @selectstart.prevent
      @contextmenu.prevent
    />
    <div v-if="!selectedRect && !selecting" class="screenshot-hint">
      拖拽选择区域，或单击高亮窗口
    </div>
    <div v-if="selectedRect" class="screenshot-toolbar" :style="toolbarStyle">
      <button class="screenshot-action confirm" @click="confirm">完成</button>
      <button class="screenshot-action" @click="cancel">取消</button>
      <span v-if="copyError" class="screenshot-error">{{ copyError }}</span>
    </div>
  </div>
</template>

<style scoped>
.screenshot-capture {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #000;
  cursor: crosshair;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  -webkit-app-region: no-drag;
}

.screenshot-canvas {
  width: 100vw;
  height: 100vh;
  display: block;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  -webkit-app-region: no-drag;
  touch-action: none;
}

.screenshot-hint {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
  pointer-events: none;
  white-space: nowrap;
}

.screenshot-toolbar {
  position: fixed;
  display: flex;
  gap: 8px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(16, 24, 32, 0.88);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
  transform: translateX(-100%);
}

.screenshot-action {
  min-width: 58px;
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  font-size: 13px;
  cursor: pointer;
}

.screenshot-action:hover {
  background: rgba(255, 255, 255, 0.22);
}

.screenshot-action.confirm {
  background: #16a34a;
}

.screenshot-action.confirm:hover {
  background: #15803d;
}

.screenshot-error {
  display: flex;
  align-items: center;
  padding: 0 6px;
  color: #fca5a5;
  font-size: 12px;
  white-space: nowrap;
}
</style>
