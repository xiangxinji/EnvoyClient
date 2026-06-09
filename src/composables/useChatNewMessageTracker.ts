import { ref, watch, nextTick, onBeforeUnmount, type Ref } from "vue";
import type { TimelineItem } from "../types";

export function useChatNewMessageTracker(deps: {
  conversation: Ref<TimelineItem[]>;
  messageList: Ref<HTMLDivElement | null>;
  resetDisplayCount: () => void;
}) {
  const { conversation, messageList, resetDisplayCount } = deps;
  const newMessageIds = ref<Set<string>>(new Set());
  let prevConvLength = 0;
  let pinnedToBottom = true;

  function scrollToBottom() {
    const el = messageList.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
      pinnedToBottom = true;
    }
  }

  // Detect user scroll-up → unpin
  function handleUserScroll() {
    const el = messageList.value;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 100) {
      pinnedToBottom = false;
    }
  }

  // Re-scroll when images finish loading (content height changes after img onload)
  function handleImageLoad(e: Event) {
    const el = messageList.value;
    if (el && (e.target as HTMLElement)?.tagName === 'IMG' && pinnedToBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }

  // Scroll to bottom on new messages
  watch(
    () => conversation.value.length,
    async (newLen) => {
      await nextTick();
      if (newLen > prevConvLength) {
        const added = newLen - prevConvLength;
        const ids = new Set<string>();
        for (let i = newLen - added; i < newLen; i++) {
          ids.add(conversation.value[i].id);
        }
        newMessageIds.value = ids;
        setTimeout(() => { newMessageIds.value = new Set(); }, 700);
      }
      prevConvLength = newLen;
      scrollToBottom();
    },
    { flush: 'post' },
  );

  // Attach event listeners to the message list container
  watch(messageList, (el, oldEl) => {
    oldEl?.removeEventListener('scroll', handleUserScroll);
    oldEl?.removeEventListener('load', handleImageLoad, true);
    el?.addEventListener('scroll', handleUserScroll);
    el?.addEventListener('load', handleImageLoad, true);
  }, { flush: 'post' });

  onBeforeUnmount(() => {
    messageList.value?.removeEventListener('scroll', handleUserScroll);
    messageList.value?.removeEventListener('load', handleImageLoad, true);
  });

  function resetDisplayCountWithConv() {
    resetDisplayCount();
    prevConvLength = conversation.value.length;
    newMessageIds.value = new Set();
    pinnedToBottom = true;
  }

  return { newMessageIds, resetDisplayCountWithConv };
}
