import { ref } from "vue";
import type { MemberInfo } from "../types";
import type RichEditor from "../components/RichEditor";
import type MentionPopup from "../components/MentionPopup";

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
    const { from } = editor.state.selection;
    const $pos = editor.state.selection.$from;
    const textBefore = editor.state.doc.textBetween($pos.start(), from, "\n", "");
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
    const { from } = editor.state.selection;
    const $pos = editor.state.selection.$from;
    const textBefore = editor.state.doc.textBetween($pos.start(), from, "\n", "");
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      const fromInNode = $pos.parentOffset - (atMatch[0]?.length ?? 0);
      const deleteFrom = from - ($pos.parentOffset - fromInNode);
      editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).insertContent(`@${memberId} `).run();
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
