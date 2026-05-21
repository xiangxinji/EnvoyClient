import { ref } from "vue";
import type { TimelineItem, ChatMessage, ForwardedRecord } from "../types";

export function useMultiSelect(
  conversation: { value: TimelineItem[] },
  sendChat: (targetId: string, text: string, options?: { forwarded?: ForwardedRecord[] }) => void,
  showToast: (msg: string, type: "success" | "error") => void,
) {
  const selectMode = ref(false);
  const selectedIds = ref<Set<string>>(new Set());
  const forwardDialogVisible = ref(false);

  function enterSelectMode() {
    selectMode.value = true;
    selectedIds.value = new Set();
  }

  function exitSelectMode() {
    selectMode.value = false;
    selectedIds.value = new Set();
  }

  function toggleMessageSelect(id: string) {
    const next = new Set(selectedIds.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds.value = next;
  }

  function handleForwardClick() {
    if (selectedIds.value.size === 0) return;
    forwardDialogVisible.value = true;
  }

  async function handleForwardConfirm(targetId: string, summaryText: string) {
    forwardDialogVisible.value = false;

    const selectedMsgs = conversation.value.filter(
      (item): item is ChatMessage => item.type === "chat" && selectedIds.value.has(item.id)
    );
    if (selectedMsgs.length === 0) return;

    const records: ForwardedRecord[] = selectedMsgs.map((m) => ({
      from: m.from,
      text: m.text,
      timestamp: m.timestamp,
      attachments: m.attachments,
      sticker: m.sticker,
      cloudRefs: m.cloudRefs,
    }));

    sendChat(targetId, summaryText, { forwarded: records });

    exitSelectMode();
    showToast(summaryText, "success");
  }

  return {
    selectMode,
    selectedIds,
    forwardDialogVisible,
    enterSelectMode,
    exitSelectMode,
    toggleMessageSelect,
    handleForwardClick,
    handleForwardConfirm,
  };
}
