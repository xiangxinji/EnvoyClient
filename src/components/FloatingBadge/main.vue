<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { getTeamClientInstance } from "../../composables/teamClientContext";

const ctx = getTeamClientInstance();
const client = ctx?.client;

const queueCount = ref(0);
const historyCount = ref(0);

const posMode = ref<"auto" | "manual">("auto");
const x = ref(0);
const y = ref(0);

const dragging = ref(false);
const dragOffset = { x: 0, y: 0 };
const SNAP_THRESHOLD = 30;
const badgeRef = ref<HTMLElement | null>(null);

function refreshCounts() {
  if (!client) {
    console.warn('[FloatingBadge] client is null');
    return;
  }
  queueCount.value = client.queueLength;
  historyCount.value = client.taskHistory.length;
  console.log('[FloatingBadge] counts:', queueCount.value, historyCount.value);
}

function onDragStart(e: MouseEvent) {
  if (posMode.value === "auto") {
    const el = badgeRef.value;
    const rect = el?.getBoundingClientRect();
    if (rect) {
      x.value = rect.left;
      y.value = rect.top;
    }
    posMode.value = "manual";
  }
  dragging.value = true;
  dragOffset.x = e.clientX - x.value;
  dragOffset.y = e.clientY - y.value;
  e.preventDefault();
}

function onDragMove(e: MouseEvent) {
  if (!dragging.value) return;
  x.value = e.clientX - dragOffset.x;
  y.value = e.clientY - dragOffset.y;
}

function onDragEnd() {
  if (!dragging.value) return;
  dragging.value = false;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const el = badgeRef.value;
  const elW = el?.offsetWidth ?? 70;
  const elH = el?.offsetHeight ?? 36;

  const distLeft = x.value;
  const distRight = vw - (x.value + elW);
  const distTop = y.value;
  const distBottom = vh - (y.value + elH);

  const minH = Math.min(distLeft, distRight);
  const minV = Math.min(distTop, distBottom);

  if (minH < SNAP_THRESHOLD) {
    x.value = distLeft < distRight ? 10 : vw - elW - 10;
  }
  if (minV < SNAP_THRESHOLD) {
    y.value = distTop < distBottom ? 10 : vh - elH - 10;
  }
}

onMounted(() => {
  refreshCounts();

  // Poll for updates since events may not fire for existing tasks
  const timer = setInterval(refreshCounts, 3000);

  window.addEventListener("mousemove", onDragMove);
  window.addEventListener("mouseup", onDragEnd);

  onUnmounted(() => {
    clearInterval(timer);
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  });
});
</script>

<template>
  <div
    ref="badgeRef"
    class="floating-badge"
    :style="posMode === 'auto' ? { right: '16px', bottom: '16px' } : { left: `${x}px`, top: `${y}px` }"
    :class="{ dragging }"
    @mousedown="onDragStart"
  >
    <span class="badge-item">
      <span class="badge-label">Q</span>
      <span class="badge-value">{{ queueCount }}</span>
    </span>
    <span class="badge-divider"></span>
    <span class="badge-item">
      <span class="badge-label">H</span>
      <span class="badge-value">{{ historyCount }}</span>
    </span>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
