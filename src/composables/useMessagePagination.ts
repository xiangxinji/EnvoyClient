import { ref, computed, nextTick, watch } from "vue";
import type { TimelineItem } from "../types";

export function useMessagePagination(
  conversation: { value: TimelineItem[] },
  messageList: { value: HTMLDivElement | null },
) {
  const PAGE_SIZE = 50;
  const displayCount = ref(PAGE_SIZE);
  const loadingMore = ref(false);

  const visibleMessages = computed<TimelineItem[]>(() => {
    return conversation.value.slice(-displayCount.value);
  });

  const hasMoreHistory = computed(() => {
    return displayCount.value < conversation.value.length;
  });

  function isNearBottom(el: HTMLElement, threshold = 100): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }

  watch(
    () => conversation.value.length,
    async () => {
      await nextTick();
      if (messageList.value && isNearBottom(messageList.value)) {
        messageList.value.scrollTop = messageList.value.scrollHeight;
      }
    }
  );

  function handleScroll() {
    const el = messageList.value;
    if (!el) return;

    if (el.scrollTop < 50 && hasMoreHistory.value && !loadingMore.value) {
      const prevScrollHeight = el.scrollHeight;
      loadingMore.value = true;
      displayCount.value += PAGE_SIZE;
      nextTick(() => {
        if (messageList.value) {
          messageList.value.scrollTop = messageList.value.scrollHeight - prevScrollHeight;
        }
        loadingMore.value = false;
      });
    }
  }

  function resetDisplayCount() {
    displayCount.value = PAGE_SIZE;
  }

  function loadAll() {
    displayCount.value = conversation.value.length;
  }

  return {
    visibleMessages,
    hasMoreHistory,
    loadingMore,
    handleScroll,
    resetDisplayCount,
    loadAll,
  };
}
