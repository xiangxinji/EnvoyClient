import { ref } from "vue";
import type { CloudSearchResult } from "../services/types";
import type RichEditor from "../components/RichEditor";
import type CloudMentionPopup from "../components/CloudMentionPopup";

export function useCloudMention(
  richEditorRef: ReturnType<typeof ref<InstanceType<typeof RichEditor> | null>>,
) {
  const currentCloudRefs = ref<CloudSearchResult[]>([]);
  const cloudPopupVisible = ref(false);
  const cloudQuery = ref("");
  const cloudPopupRef = ref<InstanceType<typeof CloudMentionPopup> | null>(null);

  function handleEditorInput() {
    const editor = richEditorRef.value?.editor;
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

  function handleCloudSelect(item: CloudSearchResult) {
    const editor = richEditorRef.value?.editor;
    if (!editor) return;
    const { from } = editor.state.selection;
    const $pos = editor.state.selection.$from;
    const textBefore = editor.state.doc.textBetween($pos.start(), from, "\n", "");
    const hashMatch = textBefore.match(/#([\w.\-]*)$/);
    if (hashMatch) {
      const fromInNode = $pos.parentOffset - (hashMatch[0]?.length ?? 0);
      const deleteFrom = from - ($pos.parentOffset - fromInNode);
      editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).insertContent({
        type: "cloudReference",
        attrs: { name: item.name, path: item.path, type: item.type, size: item.size },
      }).run();
    }
    if (!currentCloudRefs.value.some(r => r.path === item.path)) {
      currentCloudRefs.value.push(item);
    }
    cloudPopupVisible.value = false;
  }

  function handleCloudClose() {
    cloudPopupVisible.value = false;
  }

  function handleCloudKeydown(e: KeyboardEvent) {
    if (!cloudPopupVisible.value) return;
    cloudPopupRef.value?.handleKeydown(e);
  }

  function clearCloudRefs() {
    currentCloudRefs.value = [];
    cloudPopupVisible.value = false;
  }

  return {
    currentCloudRefs,
    cloudPopupVisible,
    cloudQuery,
    cloudPopupRef,
    handleEditorInput,
    handleCloudSelect,
    handleCloudClose,
    handleCloudKeydown,
    clearCloudRefs,
  };
}
