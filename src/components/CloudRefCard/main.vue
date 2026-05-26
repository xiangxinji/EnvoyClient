<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import type { CloudRef } from "../../types";
import { formatFileSize } from "../../utils/taskFormatters";
import { getCloudResourceService } from "../../composables/teamClientContext";
import { downloadFileWithDialog } from "../../utils/notification";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

const props = defineProps<{
  data: CloudRef;
  teamName?: string;
}>();

const emit = defineEmits<{
  openDir: [data: CloudRef];
}>();

const expired = ref(false);
const downloading = ref(false);
let cancelled = false;

onMounted(async () => {
  // Old messages without id field — show as expired
  if (!props.data.id) {
    expired.value = true;
    return;
  }
  try {
    const result = await getCloudResourceService().validateIds([props.data.id]);
    if (!cancelled) expired.value = result[props.data.id] === false;
  } catch {
    // silent
  }
});

onUnmounted(() => { cancelled = true; });

async function handleDownload() {
  if (downloading.value || expired.value || !props.data.id) return;
  downloading.value = true;
  try {
    const url = getCloudResourceService().downloadUrl(props.data.id);
    await downloadFileWithDialog(url, props.data.name, props.teamName ? { team: props.teamName } : undefined);
  } catch {
    // silent
  } finally {
    downloading.value = false;
  }
}

function handleDirClick() {
  if (!expired.value) emit("openDir", props.data);
}
</script>

<template>
  <div v-if="expired" class="cloud-card expired">
    <div class="cloud-card-icon"><SvgIcon :name="data.type === 'directory' ? 'folder' : 'file'" :size="16" /></div>
    <div class="cloud-card-info">
      <span class="cloud-card-name">{{ data.name }}</span>
      <span class="cloud-card-meta">
        <SvgIcon name="cloud" :size="10" class="cloud-badge-icon" />
        <span class="cloud-badge-text">{{ t('cloudMention.cloudResource') }}</span>
        <span class="cloud-card-expired">{{ t('cloudMention.expired') }}</span>
      </span>
    </div>
  </div>

  <div v-else-if="data.type === 'file'" class="cloud-card file" @click="handleDownload">
    <div class="cloud-card-icon"><SvgIcon name="file" :size="16" /></div>
    <div class="cloud-card-info">
      <span class="cloud-card-name">{{ data.name }}</span>
      <span class="cloud-card-meta">
        <SvgIcon name="cloud" :size="10" class="cloud-badge-icon" />
        <span class="cloud-badge-text">{{ t('cloudMention.cloudResource') }}</span>
        <span class="cloud-card-size">{{ formatFileSize(data.size ?? 0) }}</span>
      </span>
    </div>
    <SvgIcon class="cloud-card-action" name="download" :size="14" />
  </div>

  <div v-else class="cloud-card directory" @click="handleDirClick">
    <div class="cloud-card-icon"><SvgIcon name="folder" :size="16" /></div>
    <div class="cloud-card-info">
      <span class="cloud-card-name">{{ data.name }}</span>
      <span class="cloud-card-meta">
        <SvgIcon name="cloud" :size="10" class="cloud-badge-icon" />
        <span class="cloud-badge-text">{{ t('cloudMention.cloudResource') }}</span>
      </span>
    </div>
    <SvgIcon class="cloud-card-action" name="chevron-right" :size="14" />
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
