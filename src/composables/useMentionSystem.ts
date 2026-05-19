import { ref } from "vue";
import type { MemberInfo } from "../types";
import type RichEditor from "../components/RichEditor.vue";
import type MentionPopup from "../components/MentionPopup.vue";

export function useMentionSystem(
  isChannel: () => boolean,
  _members: () => MemberInfo[],
  richEditorRef: ReturnType<typeof ref<InstanceType<typeof RichEditor> | null>>,
) {
  const currentMentions = ref<string[]>([]);
  const mentionPopupVisible = ref(false);
  const mentionQuery = ref("");
  const mentionPopupRef = ref<InstanceType<typeof MentionPopup> | null>(null);

  function handleEditorInput() {
    if (!isChannel()) return;
    const editor = richEditorRef.value?.editor;
    if (!editor) return;
    const text = editor.getText();
    const cursorPos = editor.state.selection.from;
    const textBefore = text.substring(0, Math.min(cursorPos, text.length));
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      mentionQuery.value = atMatch[1] ?? "";
      mentionPopupVisible.value = true;
    } else {
      mentionPopupVisible.value = false;
    }
  }

  function handleMentionSelect(memberId: string) {
    const editor = richEditorRef.value?.editor;
    if (!editor) return;
    const text = editor.getText();
    const cursorPos = editor.state.selection.from;
    const textBefore = text.substring(0, Math.min(cursorPos, text.length));
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      const from = cursorPos - (atMatch[0]?.length ?? 0);
      editor.chain().focus().deleteRange({ from, to: cursorPos }).insertContent(`@${memberId} `).run();
    }
    if (!currentMentions.value.includes(memberId)) {
      currentMentions.value.push(memberId);
    }
    mentionPopupVisible.value = false;
  }

  function handleMentionClose() {
    mentionPopupVisible.value = false;
  }

  function handleEditorKeydown(e: KeyboardEvent) {
    if (mentionPopupVisible.value) {
      const handled = ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"];
      if (handled.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
      mentionPopupRef.value?.handleKeydown(e);
    }
  }

  function clearMentions() {
    currentMentions.value = [];
    mentionPopupVisible.value = false;
  }

  return {
    currentMentions,
    mentionPopupVisible,
    mentionQuery,
    mentionPopupRef,
    handleEditorInput,
    handleMentionSelect,
    handleMentionClose,
    handleEditorKeydown,
    clearMentions,
  };
}
