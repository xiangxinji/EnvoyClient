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

const { t } = useI18n();

export interface PendingImage {
  blob: Blob;
  objectUrl: string;
  name: string;
}

const props = defineProps<{
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  send: [text: string, images: PendingImage[]];
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
        handleSend();
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
  const html = editor.value.getHTML();
  const text = extractText(html);

  emit("send", text, [...pendingImages.value]);
  editor.value.commands.clearContent();
  for (const img of pendingImages.value) URL.revokeObjectURL(img.objectUrl);
  pendingImages.value = [];
}

function extractText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  for (const img of div.querySelectorAll("img")) img.remove();
  //innerText on detached elements doesn't preserve newlines, so we convert manually
  let text = "";
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName;
      for (const child of Array.from(el.childNodes)) walk(child);
      if (tag === "P" || tag === "BR" || tag === "DIV") text += "\n";
    }
  }
  walk(div);
  return text.replace(/\n{3,}/g, "\n\n").trim();
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
