<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import HardBreak from "@tiptap/extension-hard-break";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import type { ContentSegment } from "../../types";

const { t } = useI18n();

export interface PendingImage {
  blob: Blob;
  objectUrl: string;
  name: string;
}

const props = defineProps<{
  disabled?: boolean;
  placeholder?: string;
  enterSendDisabled?: boolean;
}>();

const emit = defineEmits<{
  send: [segments: ContentSegment[]];
  input: [];
}>();

const pendingImages = ref<PendingImage[]>([]);

const editor = useEditor({
  extensions: [
    Document,
    Paragraph,
    Text,
    HardBreak,
    Placeholder.configure({ placeholder: () => props.placeholder ?? t('chat.enterMessage') }),
    Image.configure({ inline: false, allowBase64: true }),
  ],
  editorProps: {
    attributes: {
      class: "editor-body",
    },
    handleKeyDown(_view, event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (!props.enterSendDisabled) handleSend();
        return true;
      }
      return false;
    },
    handlePaste(_view, event) {
      const items = event.clipboardData?.items;
      if (!items) return false;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) insertImageBlob(file);
          return true;
        }
      }

      const text = event.clipboardData?.getData("text/plain");
      if (text) {
        event.preventDefault();
        insertPlainText(text);
        return true;
      }
      return false;
    },
    handleDrop(_view, event) {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return false;

      let handled = false;
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          handled = true;
          insertImageBlob(file);
        }
      }
      if (handled) event.preventDefault();
      return handled;
    },
  },
  onUpdate() {
    emit("input");
  },
});

function insertPlainText(text: string) {
  if (!editor.value) return;
  const paragraphs = text.split("\n");
  const content = paragraphs.map((p) => ({ type: "text", text: p }));
  editor.value.chain().focus().insertContent(content).run();
}

function insertImageBlob(file: File) {
  if (!editor.value) return;
  const url = URL.createObjectURL(file);
  pendingImages.value.push({ blob: file, objectUrl: url, name: file.name });
  editor.value.chain().focus().setImage({ src: url }).createParagraphNear().run();
}

function handleSend() {
  if (!editor.value) return;
  const segments = extractSegments();

  emit("send", segments);
  editor.value.commands.clearContent();
  for (const img of pendingImages.value) URL.revokeObjectURL(img.objectUrl);
  pendingImages.value = [];
}

function extractSegments(): ContentSegment[] {
  if (!editor.value) return [];
  const doc = editor.value.getJSON();
  const segments: ContentSegment[] = [];
  let textBuffer = "";

  function flushText() {
    const trimmed = textBuffer.trim();
    if (trimmed) {
      segments.push({ type: "text", content: trimmed });
    }
    textBuffer = "";
  }

  function walkNode(node: Record<string, unknown>) {
    const type = node.type as string;

    if (type === "text") {
      textBuffer += (node.text as string) ?? "";
      return;
    }

    if (type === "image") {
      flushText();
      const src = (node.attrs as Record<string, string>)?.src ?? "";
      const pending = pendingImages.value.find((p) => p.objectUrl === src);
      if (pending) {
        segments.push({ type: "image", blob: pending.blob, name: pending.name });
      }
      return;
    }

    if (type === "hardBreak") {
      textBuffer += "\n";
      return;
    }

    const content = node.content as Record<string, unknown>[] | undefined;
    if (content) {
      for (const child of content) {
        walkNode(child);
      }
    }

    if (type === "paragraph") {
      textBuffer += "\n";
    }
  }

  walkNode(doc as Record<string, unknown>);
  flushText();
  return segments;
}

function focus() {
  editor.value?.commands.focus();
}

function isEmpty(): boolean {
  if (!editor.value) return true;
  return editor.value.isEmpty && pendingImages.value.length === 0;
}

function insertImage(file: File) {
  if (!editor.value) return;
  const url = URL.createObjectURL(file);
  pendingImages.value.push({ blob: file, objectUrl: url, name: file.name });
  editor.value.chain().focus().setImage({ src: url }).createParagraphNear().run();
}

defineExpose({ focus, isEmpty, send: handleSend, insertImage, editor });

onBeforeUnmount(() => {
  for (const img of pendingImages.value) URL.revokeObjectURL(img.objectUrl);
});
</script>

<template>
  <div class="rich-editor" :class="{ disabled }" @click="focus">
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
