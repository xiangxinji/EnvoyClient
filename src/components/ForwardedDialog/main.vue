<script setup lang="ts">
import type { ForwardedRecord } from "../../types";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useUserProfile } from "../../composables/useUserProfile";
import { formatTime, formatFileSize } from "../../utils/taskFormatters";
import { downloadFileWithDialog } from "../../utils/notification";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();
const { getDisplayName } = useUserProfile();

const props = defineProps<{
  records: ForwardedRecord[];
  visible: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const downloading = ref(false);

async function handleFileDownload(att: { url: string; name: string }) {
  if (downloading.value) return;
  downloading.value = true;
  try { await downloadFileWithDialog(att.url, att.name); } catch { /* download failed */ }
  finally { downloading.value = false; }
}

function close() {
  emit("update:visible", false);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

watch(() => props.visible, (open) => {
  if (open) document.addEventListener("keydown", handleKeydown);
  else document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="viewer">
      <div v-if="visible" class="forwarded-dialog-overlay" @click="close">
        <div class="forwarded-dialog" @click.stop>
          <div class="forwarded-dialog-header">
            <span>{{ t('chat.chatHistory') }}</span>
            <button class="forwarded-dialog-close" @click="close"><SvgIcon name="close" :size="16" /></button>
          </div>
          <div class="forwarded-dialog-body">
            <div v-for="(rec, i) in records" :key="i" class="fd-record">
              <div class="fd-meta">{{ getDisplayName(rec.from) }} · {{ formatTime(rec.timestamp) }}</div>
              <div v-if="rec.text" class="fd-text">{{ rec.text }}</div>
              <div v-if="rec.attachments?.length" class="fd-attachments">
                <template v-for="(att, j) in rec.attachments" :key="j">
                  <div v-if="att.type === 'image'" class="image-card"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
                  <div v-else class="file-card" @click="handleFileDownload(att)">
                    <div class="file-icon"><SvgIcon name="file" :size="16" /></div>
                    <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.forwarded-dialog-overlay { position: fixed; inset: 0; z-index: 9998; background: var(--overlay-bg); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; }
.forwarded-dialog { width: 440px; max-height: 70vh; display: flex; flex-direction: column; background: var(--glass-bg-heavy); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); border-radius: var(--radius-md); box-shadow: var(--glass-shadow-heavy); overflow: hidden; }
.forwarded-dialog-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-md) var(--space-lg); font-weight: 600; font-size: 0.95em; color: var(--text-primary); border-bottom: 1px solid var(--glass-border); }
.forwarded-dialog-close { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
.forwarded-dialog-close:hover { background: var(--glass-bg-light); color: var(--text-primary); }
.forwarded-dialog-body { flex: 1; overflow-y: auto; padding: var(--space-md) var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md); }
.fd-record { padding-bottom: var(--space-md); border-bottom: 1px solid var(--glass-border); }
.fd-record:last-child { border-bottom: none; padding-bottom: 0; }
.fd-meta { font-size: 0.75em; color: var(--text-muted); margin-bottom: var(--space-xs); }
.fd-text { font-size: 0.9em; color: var(--text-primary); line-height: 1.5; word-break: break-word; }
.fd-attachments { display: flex; flex-direction: column; gap: var(--space-xs); margin-top: var(--space-xs); }
.fd-attachments .image-card { border: none; }
.fd-attachments .file-card { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-md); background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-md); cursor: pointer; max-width: 280px; }

.viewer-enter-active { transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.viewer-leave-active { transition: opacity 0.2s cubic-bezier(0.4, 0, 1, 1); }
.viewer-enter-from, .viewer-leave-to { opacity: 0; }
</style>
