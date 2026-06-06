import { ref, watch, nextTick, type Ref } from "vue";
import type { TimelineItem } from "../types";

export function useChatNewMessageTracker(deps: {
  conversation: Ref<TimelineItem[]>;
  messageList: Ref<HTMLDivElement | null>;
  resetDisplayCount: () => void;
}) {
  const { conversation, messageList, resetDisplayCount } = deps;
  const newMessageIds = ref<Set<string>>(new Set());
  let prevConvLength = 0;

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
      // Scroll to bottom on new message
      if (messageList.value) {
        messageList.value.scrollTop = messageList.value.scrollHeight;
      }
    },
    { flush: 'post' },
  );

  function resetDisplayCountWithConv() {
    resetDisplayCount();
    prevConvLength = conversation.value.length;
    newMessageIds.value = new Set();
  }

  return { newMessageIds, resetDisplayCountWithConv };
}
