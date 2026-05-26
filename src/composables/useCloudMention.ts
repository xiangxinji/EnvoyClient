import { ref } from "vue";
import type { CloudSearchResult } from "../services/types";
import type { CloudRef } from "../types";
import type CloudMentionPopup from "../components/CloudMentionPopup";

export function useCloudMention() {
  const pendingCloudRefs = ref<CloudRef[]>([]);
  const cloudPopupVisible = ref(false);
  const cloudQuery = ref("");
  const cloudPopupRef = ref<InstanceType<typeof CloudMentionPopup> | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEditorInput(editor?: any) {
    if (!editor) return;
    const { from } = editor.state.selection;
    const $pos = editor.state.selection.$from;
    const textBefore = editor.state.doc.textBetween($pos.start(), from, "\n", "");
    const hashMatch = textBefore.match(/(?:^#|[\s(\[]#)([\w.\-]*)$/);
    if (hashMatch) {
      cloudQuery.value = hashMatch[1] ?? "";
      cloudPopupVisible.value = true;
    } else {
      cloudPopupVisible.value = false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleCloudSelect(item: CloudSearchResult, editor?: any) {
    // Remove the #query text from editor
    if (editor) {
      const { from } = editor.state.selection;
      const $from = editor.state.selection.$from;
      const docText = editor.state.doc.textBetween($from.start(), from, "\n", "");
      const hashMatch = docText.match(/#([\w.\-]*)$/);
      if (hashMatch) {
        const startPos = from - hashMatch[0].length;
        editor.chain().focus().deleteRange({ from: startPos, to: from }).run();
      }
    }

    const ref: CloudRef = { id: item.id, name: item.name, type: item.type, size: item.size };
    if (!pendingCloudRefs.value.some(r => r.id === ref.id)) {
      pendingCloudRefs.value.push(ref);
    }
    cloudPopupVisible.value = false;
  }

  function removeCloudRef(index: number) {
    pendingCloudRefs.value.splice(index, 1);
  }

  function handleCloudClose() {
    cloudPopupVisible.value = false;
  }

  function handleCloudKeydown(e: KeyboardEvent) {
    if (!cloudPopupVisible.value) return;
    cloudPopupRef.value?.handleKeydown(e);
  }

  function clearCloudRefs() {
    pendingCloudRefs.value = [];
    cloudPopupVisible.value = false;
  }

  return {
    pendingCloudRefs,
    cloudPopupVisible,
    cloudQuery,
    cloudPopupRef,
    handleEditorInput,
    handleCloudSelect,
    removeCloudRef,
    handleCloudClose,
    handleCloudKeydown,
    clearCloudRefs,
  };
}
