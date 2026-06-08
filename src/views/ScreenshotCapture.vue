<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Event } from "@tauri-apps/api/event";
import type { ScreenCapture } from "../composables/useScreenshot";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
const capture = ref<ScreenCapture | null>(null);
const selectedRect = ref<Rect | null>(null);
const selecting = ref(false);
const copyError = ref("");

let startPoint = { x: 0, y: 0 };
let currentPoint = { x: 0, y: 0 };
let unlistenData: (() => void) | null = null;
let unlistenReset: (() => void) | null = null;

const scaleX = computed(() => (capture.value?.width || 1) / Math.max(1, window.innerWidth));
const scaleY = computed(() => (capture.value?.height || 1) / Math.max(1, window.innerHeight));
const toolbarStyle = computed(() => {
  if (!selectedRect.value || !capture.value) return {};
  const rect = selectedRect.value;
  const cssX = rect.x / scaleX.value;
  const cssY = rect.y / scaleY.value;
  const cssW = rect.width / scaleX.value;
  const cssH = rect.height / scaleY.value;
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
  return {
    x: clamp(Math.round(e.clientX * scaleX.value), 0, data?.width ?? 0),
    y: clamp(Math.round(e.clientY * scaleY.value), 0, data?.height ?? 0),
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
  ctx.font = `${Math.round(12 * scaleX.value)}px system-ui, sans-serif`;
  const metrics = ctx.measureText(label);
  const paddingX = 6 * scaleX.value;
  const labelH = 22 * scaleY.value;
  const labelW = metrics.width + paddingX * 2;
  const labelX = rect.x;
  const labelY = rect.y > labelH + 6 ? rect.y - labelH - 6 : rect.y + rect.height + 6;
  ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
  ctx.fillRect(labelX, labelY, labelW, labelH);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, labelX + paddingX, labelY + 15 * scaleY.value);
  ctx.restore();
}

function draw() {
  const canvas = canvasRef.value;
  const data = capture.value;
  if (!canvas || !data) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = data.width;
  canvas.height = data.height;
  ctx.clearRect(0, 0, data.width, data.height);
  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.fillRect(0, 0, data.width, data.height);

  const activeRect = selectedRect.value || (selecting.value ? normalizeRect(startPoint, currentPoint) : null);
  if (!activeRect || activeRect.width <= 0 || activeRect.height <= 0) return;

  ctx.clearRect(activeRect.x, activeRect.y, activeRect.width, activeRect.height);
  drawRect(ctx, activeRect, "#22c55e");
  if (selectedRect.value || selecting.value) drawSizeLabel(ctx, activeRect);
}

function resetOverlay() {
  capture.value = null;
  selectedRect.value = null;
  selecting.value = false;
  copyError.value = "";
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx?.clearRect(0, 0, 1, 1);
}

function notifyOverlayReady() {
  draw();
  const id = capture.value?.id;
  if (!id) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      emitTo("main", "screenshot-overlay-ready", { id });
    });
  });
}

async function handleData(event: Event<ScreenCapture>) {
  resetOverlay();
  capture.value = event.payload;
  await getCurrentWindow().setIgnoreCursorEvents(false).catch(() => undefined);

  await nextTick();
  notifyOverlayReady();
}

function onMouseMove(e: MouseEvent) {
  e.preventDefault();
  currentPoint = pointFromMouse(e);
  if (selecting.value) {
    selectedRect.value = null;
    draw();
  }
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  startPoint = pointFromMouse(e);
  currentPoint = startPoint;
  selecting.value = true;
  selectedRect.value = null;
  draw();
}

function onMouseUp(e: MouseEvent) {
  e.preventDefault();
  if (!selecting.value) return;
  selecting.value = false;
  currentPoint = pointFromMouse(e);

  const rect = normalizeRect(startPoint, currentPoint);
  if (rect.width < 5 * scaleX.value || rect.height < 5 * scaleY.value) {
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

function blockWindowDrag(e: MouseEvent) {
  e.stopPropagation();
}

async function parkOverlay() {
  const win = getCurrentWindow();
  await win.setIgnoreCursorEvents(true).catch(() => undefined);
  resetOverlay();
}

async function cancel() {
  const id = capture.value?.id;
  await parkOverlay();
  await emitTo("main", "screenshot-cancelled", { id });
}

async function confirm() {
  const data = capture.value;
  const rect = selectedRect.value;
  if (!data || !rect) return;

  copyError.value = "";

  try {
    await parkOverlay();
    const result = await invoke("get_screenshot_result", {
      id: data.id,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
    await emitTo("main", "screenshot-complete", result);
  } catch (e) {
    console.error("Failed to copy screenshot:", e);
    await emitTo("main", "screenshot-cancelled", { id: data.id });
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
  document.documentElement.classList.add("screenshot-window");
  document.body.classList.add("screenshot-window");
  resetOverlay();
  const win = getCurrentWindow();
  await win.setAlwaysOnTop(true).catch(() => undefined);
  await win.setCursorIcon("crosshair").catch(() => undefined);
  unlistenData = await win.listen<ScreenCapture>("screenshot-data", handleData);
  unlistenReset = await win.listen("screenshot-reset", resetOverlay);
  window.addEventListener("keydown", onKeydown, true);
  document.addEventListener("mousedown", blockWindowDrag, false);
  window.addEventListener("dragstart", preventNativeDrag, true);
  window.addEventListener("selectstart", preventNativeDrag, true);
  window.addEventListener("contextmenu", preventNativeDrag, true);
  await emitTo("main", "screenshot-ready");
});

onBeforeUnmount(() => {
  unlistenData?.();
  unlistenReset?.();
  document.documentElement.classList.remove("screenshot-window");
  document.body.classList.remove("screenshot-window");
  window.removeEventListener("keydown", onKeydown, true);
  document.removeEventListener("mousedown", blockWindowDrag, false);
  window.removeEventListener("dragstart", preventNativeDrag, true);
  window.removeEventListener("selectstart", preventNativeDrag, true);
  window.removeEventListener("contextmenu", preventNativeDrag, true);
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
      拖拽选择截图区域
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
  background: transparent;
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
  background: transparent;
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
