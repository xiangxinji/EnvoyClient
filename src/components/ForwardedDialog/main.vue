<script setup lang="ts">
import type { ForwardedRecord, CloudRef } from "../../types";
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useUserProfile } from "../../composables/useUserProfile";
import { useFullscreenViewer } from "../../composables/useFullscreenViewer";
import { formatTime, formatFileSize } from "../../utils/taskFormatters";
import { getCloudResourceService } from "../../composables/teamClientContext";
import { downloadFileWithDialog } from "../../utils/notification";
import CloudDirDialog from "../CloudDirDialog";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();
const { getDisplayName } = useUserProfile();
const viewer = useFullscreenViewer();

const props = defineProps<{
  records: ForwardedRecord[];
  visible: boolean;
  teamName?: string;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const downloading = ref(false);

const cleanedRecords = computed(() =>
  props.records.map((rec) => ({
    ...rec,
    text: (rec.text || "").replace(/\{cloud:\d+\}/g, "").trim(),
  }))
);

const cloudDirDialogVisible = ref(false);
const cloudDirId = ref("");
const cloudDirName = ref("");

function handleOpenDir(data: { id: string; name: string }) {
  cloudDirId.value = data.id;
  cloudDirName.value = data.name;
  cloudDirDialogVisible.value = true;
}

async function handleFileDownload(att: { url: string; name: string }) {
  if (downloading.value) return;
  downloading.value = true;
  try { await downloadFileWithDialog(att.url, att.name); } catch { /* download failed */ }
  finally { downloading.value = false; }
}

async function handleCloudDownload(ref: CloudRef) {
  if (downloading.value) return;
  downloading.value = true;
  try {
    const url = getCloudResourceService().downloadUrl(ref.id);
    await downloadFileWithDialog(url, ref.name, props.teamName ? { team: props.teamName } : undefined);
  } catch { /* download failed */ }
  finally { downloading.value = false; }
}

function openFullscreen(url: string) {
  viewer.openFullscreen(url);
}

function close() {
  emit("update:visible", false);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (viewer.fullscreenUrl.value) { viewer.closeFullscreen(); return; }
    if (cloudDirDialogVisible.value) { cloudDirDialogVisible.value = false; return; }
    close();
  }
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
            <div v-for="(rec, i) in cleanedRecords" :key="i" class="fd-record">
              <div class="fd-meta">{{ getDisplayName(rec.from) }} · {{ formatTime(rec.timestamp) }}</div>
              <div v-if="rec.text" class="fd-text">{{ rec.text }}</div>
              <div v-if="rec.sticker" class="fd-sticker">
                <img :src="rec.sticker.url" :alt="rec.sticker.name" loading="lazy" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" @click="openFullscreen(rec.sticker!.url)" />
              </div>
              <div v-if="rec.attachments?.length" class="fd-attachments">
                <template v-for="(att, j) in rec.attachments" :key="j">
                  <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att.url)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
                  <div v-else class="file-card" @click="handleFileDownload(att)">
                    <div class="file-icon"><SvgIcon name="file" :size="16" /></div>
                    <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
                  </div>
                </template>
              </div>
              <div v-if="rec.cloudRefs?.length" class="fd-cloud-refs">
                <div v-for="(ref, j) in rec.cloudRefs" :key="j" class="cloud-card" :class="ref.type" @click="ref.type === 'file' ? handleCloudDownload(ref) : handleOpenDir({ id: ref.id, name: ref.name })">
                  <div class="cloud-card-icon"><SvgIcon :name="ref.type === 'directory' ? 'folder' : 'file'" :size="16" /></div>
                  <div class="cloud-card-info">
                    <span class="cloud-card-name">{{ ref.name }}</span>
                    <span class="cloud-card-meta">
                      <SvgIcon name="cloud" :size="10" class="cloud-badge-icon" />
                      <span class="cloud-badge-text">{{ t('cloudMention.cloudResource') }}</span>
                      <span v-if="ref.type === 'file' && ref.size" class="cloud-card-size">{{ formatFileSize(ref.size) }}</span>
                    </span>
                  </div>
                  <SvgIcon v-if="ref.type === 'file'" class="cloud-card-action" name="download" :size="14" />
                  <SvgIcon v-else class="cloud-card-action" name="chevron-right" :size="14" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <CloudDirDialog :visible="cloudDirDialogVisible" :dir-id="cloudDirId" :dir-name="cloudDirName" :team-name="props.teamName" @update:visible="cloudDirDialogVisible = $event" />
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
