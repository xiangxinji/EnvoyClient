<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { managerFetch, apiUrl } from "../../api";
import ConfirmDialog from "../ConfirmDialog";

interface StickerItem {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: number;
}

const props = defineProps<{
  myId: string;
  teamName: string;
}>();

const emit = defineEmits<{
  send: [stickerUrl: string, stickerName: string];
}>();

const { t } = useI18n();
const stickers = ref<StickerItem[]>([]);
const loading = ref(false);
const confirmVisible = ref(false);
const deleteTarget = ref<StickerItem | null>(null);
const errorMsg = ref("");

async function loadStickers() {
  loading.value = true;
  try {
    const res = await managerFetch(`/api/stickers?user=${encodeURIComponent(props.myId)}`, {
      headers: { team: props.teamName },
    });
    const data = await res.json() as { stickers: StickerItem[] };
    stickers.value = data.stickers;
  } catch (e: unknown) {
    console.error("loadStickers error:", e);
  } finally {
    loading.value = false;
  }
}

async function handleAdd() {
  errorMsg.value = "";
  try {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/gif,image/webp";
    input.multiple = true;
    const chosen = await new Promise<FileList | null>((resolve) => {
      input.onchange = () => resolve(input.files);
      input.click();
    });
    if (!chosen || chosen.length === 0) return;

    for (const file of Array.from(chosen)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("from", props.myId);
      await managerFetch("/api/stickers", {
        method: "POST",
        headers: { team: props.teamName },
        body: formData,
      });
    }
    await loadStickers();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("handleAdd error:", msg);
    errorMsg.value = msg;
  }
}

function handleDeleteClick(sticker: StickerItem) {
  deleteTarget.value = sticker;
  confirmVisible.value = true;
}

async function handleDeleteConfirm() {
  if (!deleteTarget.value) return;
  confirmVisible.value = false;
  try {
    await managerFetch(`/api/stickers/${deleteTarget.value.id}?from=${encodeURIComponent(props.myId)}`, {
      method: "DELETE",
      headers: { team: props.teamName },
    });
    await loadStickers();
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
  deleteTarget.value = null;
}

function handleDeleteCancel() {
  confirmVisible.value = false;
  deleteTarget.value = null;
}

function handleStickerClick(sticker: StickerItem) {
  emit("send", apiUrl(sticker.url), sticker.name);
}

onMounted(loadStickers);
defineExpose({ loadStickers });
</script>

<template>
  <div class="sticker-panel">
    <div v-if="loading" class="sticker-loading"><span class="spinner-small"></span></div>
    <div v-else-if="stickers.length === 0" class="sticker-empty">
      <p>{{ t('sticker.empty') }}</p>
      <button type="button" class="btn-add" @click="handleAdd">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        {{ t('sticker.add') }}
      </button>
    </div>
    <template v-else>
      <div class="sticker-grid">
        <div v-for="sticker in stickers" :key="sticker.id" class="sticker-item" @click="handleStickerClick(sticker)">
          <img :src="apiUrl(sticker.url)" :alt="sticker.name" class="sticker-thumb" />
          <button type="button" class="sticker-delete" @click.stop="handleDeleteClick(sticker)" :title="t('sticker.delete')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>
      <div class="sticker-footer">
        <button type="button" class="btn-add-small" @click="handleAdd" :title="t('sticker.add')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>
    </template>
    <div v-if="errorMsg" class="sticker-error">{{ errorMsg }}</div>
  </div>
  <ConfirmDialog :visible="confirmVisible" :title="t('sticker.confirmDeleteTitle')" :message="t('sticker.confirmDeleteMsg')" :confirm-text="t('sticker.delete')" :danger="true" @confirm="handleDeleteConfirm" @cancel="handleDeleteCancel" />
</template>

<style scoped>
@import './styles.css';
</style>
