import { ref, onUnmounted } from "vue";

export function useHoverCard<T>() {
  const hoveredItem = ref<T | null>(null);
  const hoverRect = ref<DOMRect | null>(null);
  const visible = ref(false);
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function show(item: T, element: HTMLElement) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    showTimer = setTimeout(() => {
      hoveredItem.value = item;
      hoverRect.value = element.getBoundingClientRect();
      visible.value = true;
    }, 150);
  }

  function scheduleHide() {
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    hideTimer = setTimeout(() => { visible.value = false; }, 100);
  }

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  onUnmounted(() => {
    if (showTimer) clearTimeout(showTimer);
    if (hideTimer) clearTimeout(hideTimer);
  });

  return { hoveredItem, hoverRect, visible, show, scheduleHide, cancelHide };
}
