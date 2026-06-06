import { ref, computed, watch } from "vue";

// Module-level singleton state — only one fullscreen viewer instance globally
const fullscreenUrl = ref<string | null>(null);
const imageScale = ref(1);
const imageRotation = ref(0);
const panX = ref(0);
const panY = ref(0);
const isDragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;
let panStartX = 0;
let panStartY = 0;

const imageTransform = computed(() =>
  `translate(${panX.value}px, ${panY.value}px) scale(${imageScale.value}) rotate(${imageRotation.value}deg)`
);

function openFullscreen(url: string) {
  fullscreenUrl.value = url;
  imageScale.value = 1;
  imageRotation.value = 0;
  panX.value = 0;
  panY.value = 0;
}

function closeFullscreen() {
  fullscreenUrl.value = null;
  isDragging.value = false;
}

function zoomIn() { imageScale.value = Math.min(imageScale.value + 0.25, 5); }
function zoomOut() { imageScale.value = Math.max(imageScale.value - 0.25, 0.25); }

function resetZoom() {
  imageScale.value = 1;
  imageRotation.value = 0;
  panX.value = 0;
  panY.value = 0;
}

function rotateLeft() { imageRotation.value = (imageRotation.value - 90 + 360) % 360; }
function rotateRight() { imageRotation.value = (imageRotation.value + 90) % 360; }

function downloadImage() {
  if (!fullscreenUrl.value) return;
  const a = document.createElement("a");
  a.href = fullscreenUrl.value;
  a.download = "";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function onImageWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  imageScale.value = Math.min(Math.max(imageScale.value + delta, 0.25), 5);
}

function onDragStart(e: MouseEvent) {
  isDragging.value = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  panStartX = panX.value;
  panStartY = panY.value;
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value) return;
  panX.value = panStartX + (e.clientX - dragStartX);
  panY.value = panStartY + (e.clientY - dragStartY);
}

function onDragEnd() { isDragging.value = false; }

function handleFullscreenKey(e: KeyboardEvent) {
  if (e.key === "Escape") closeFullscreen();
}

// Module-level watcher — keydown listener follows fullscreen state
watch(fullscreenUrl, (url) => {
  if (url) document.addEventListener("keydown", handleFullscreenKey);
  else document.removeEventListener("keydown", handleFullscreenKey);
});

export function useFullscreenViewer() {
  return {
    fullscreenUrl,
    imageScale,
    imageRotation,
    isDragging,
    imageTransform,
    openFullscreen,
    closeFullscreen,
    zoomIn,
    zoomOut,
    resetZoom,
    rotateLeft,
    rotateRight,
    downloadImage,
    onImageWheel,
    onDragStart,
    onDragMove,
    onDragEnd,
  };
}
