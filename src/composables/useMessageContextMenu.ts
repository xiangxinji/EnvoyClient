import { ref, nextTick } from "vue";
import type { ChatMessage } from "../types";
import { useI18n } from "vue-i18n";

export function useMessageContextMenu(
  messageList: ReturnType<typeof ref<HTMLDivElement | null>>,
  loadAll: () => void,
  revokeMessage: (peerId: string, msgId: string) => Promise<boolean>,
  enterSelectMode: () => void,
  setSelectIds: (ids: Set<string>) => void,
  toastCallback: (msg: string, type: "success" | "error") => void,
) {
  const { t } = useI18n();

  const contextMenuVisible = ref(false);
  const contextMenuX = ref(0);
  const contextMenuY = ref(0);
  const contextMenuMsg = ref<ChatMessage | null>(null);
  const quotingMsg = ref<ChatMessage | null>(null);

  const QUOTE_TEXT_LIMIT = 100;

  function handleMessageContextmenu(rect: DOMRect, message: ChatMessage) {
    contextMenuMsg.value = message;
    contextMenuX.value = message.mine ? rect.right - 120 : rect.left;
    contextMenuY.value = rect.bottom + 4;
    contextMenuVisible.value = true;
  }

  function handleQuoteReply(focusEditor: () => void) {
    contextMenuVisible.value = false;
    if (!contextMenuMsg.value) return;
    quotingMsg.value = contextMenuMsg.value;
    contextMenuMsg.value = null;
    nextTick(() => focusEditor());
  }

  function handleContextForward() {
    contextMenuVisible.value = false;
    if (!contextMenuMsg.value) return;
    const id = contextMenuMsg.value.id;
    contextMenuMsg.value = null;
    enterSelectMode();
    setSelectIds(new Set([id]));
  }

  function clearQuotingMsg() {
    quotingMsg.value = null;
  }

  function generateSnapshotText(msg: ChatMessage): string {
    if (msg.forwarded?.length) return t('chat.quotePlaceholderForwarded');
    if (!msg.text || !msg.text.trim()) {
      if (msg.attachments?.some(a => a.type === 'image')) return t('chat.quotePlaceholderImage');
      const file = msg.attachments?.find(a => a.type === 'file');
      if (file) return t('chat.quotePlaceholderFile') + ' ' + file.name;
      return '';
    }
    return msg.text.length > QUOTE_TEXT_LIMIT ? msg.text.slice(0, QUOTE_TEXT_LIMIT) : msg.text;
  }

  async function handleRevoke(peerId: string) {
    contextMenuVisible.value = false;
    if (!contextMenuMsg.value || !peerId) return;
    const ok = await revokeMessage(peerId, contextMenuMsg.value.id);
    toastCallback(
      ok ? t('chat.revokeSuccess') : t('chat.revokeFailed'),
      ok ? "success" : "error",
    );
    contextMenuMsg.value = null;
  }

  function handleScrollToQuote(quoteId: string) {
    const el = messageList.value;
    if (!el) return;

    let target = el.querySelector(`[data-id="${quoteId}"]`) as HTMLElement | null;

    if (!target) {
      const prevScrollHeight = el.scrollHeight;
      loadAll();
      nextTick(() => {
        target = el.querySelector(`[data-id="${quoteId}"]`) as HTMLElement | null;
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlightMessage(target);
        } else if (messageList.value) {
          messageList.value.scrollTop = messageList.value.scrollHeight - prevScrollHeight;
        }
      });
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightMessage(target);
  }

  function highlightMessage(el: HTMLElement) {
    el.classList.add('quote-highlight');
    setTimeout(() => el.classList.remove('quote-highlight'), 1500);
  }

  function closeContextMenu(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".context-menu")) {
      contextMenuVisible.value = false;
    }
  }

  return {
    contextMenuVisible,
    contextMenuX,
    contextMenuY,
    contextMenuMsg,
    quotingMsg,
    handleMessageContextmenu,
    handleQuoteReply,
    handleContextForward,
    clearQuotingMsg,
    generateSnapshotText,
    handleRevoke,
    handleScrollToQuote,
    closeContextMenu,
  };
}
