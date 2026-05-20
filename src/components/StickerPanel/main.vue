<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { managerFetch, apiUrl } from "../../api";
import { getErrorMessage } from "../../utils/error";
import { useConfirm } from "../../composables/useConfirm";
import ConfirmDialog from "../ConfirmDialog";
import SvgIcon from "../SvgIcon";

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
const errorMsg = ref("");

const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();

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
    const msg = getErrorMessage(e);
    console.error("handleAdd error:", msg);
    errorMsg.value = msg;
  }
}

function handleDeleteClick(sticker: StickerItem) {
  showConfirm(t('sticker.confirmDeleteTitle'), t('sticker.confirmDeleteMsg'), async () => {
    try {
      await managerFetch(`/api/stickers/${sticker.id}?from=${encodeURIComponent(props.myId)}`, {
        method: "DELETE",
        headers: { team: props.teamName },
      });
      await loadStickers();
    } catch (e: unknown) {
      errorMsg.value = getErrorMessage(e);
    }
  }, true);
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
        <SvgIcon name="plus" :size="16" />
        {{ t('sticker.add') }}
      </button>
    </div>
    <template v-else>
      <div class="sticker-grid">
        <div v-for="sticker in stickers" :key="sticker.id" class="sticker-item" @click="handleStickerClick(sticker)">
          <img :src="apiUrl(sticker.url)" :alt="sticker.name" class="sticker-thumb" />
          <button type="button" class="sticker-delete" @click.stop="handleDeleteClick(sticker)" :title="t('sticker.delete')">
            <SvgIcon name="close" :size="12" />
          </button>
        </div>
      </div>
      <div class="sticker-footer">
        <button type="button" class="btn-add-small" @click="handleAdd" :title="t('sticker.add')">
          <SvgIcon name="plus" :size="16" />
        </button>
      </div>
    </template>
    <div v-if="errorMsg" class="sticker-error">{{ errorMsg }}</div>
  </div>
  <ConfirmDialog :visible="confirmVisible" :title="confirmTitle" :message="confirmMessage" :danger="confirmDanger" @confirm="handleConfirm" @cancel="handleCancel" />
</template>

<style scoped>
@import './styles.css';
</style>
