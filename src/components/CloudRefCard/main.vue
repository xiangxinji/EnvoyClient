<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import type { CloudRef } from "../../types";
import { formatFileSize } from "../../utils/taskFormatters";
import { getCloudResourceService } from "../../composables/teamClientContext";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

const props = defineProps<{
  data: CloudRef;
  teamName?: string;
}>();

const expired = ref(false);
let cancelled = false;

onMounted(async () => {
  if (!props.data.path) return;
  try {
    const result = await getCloudResourceService().validatePaths([props.data.path]);
    if (!cancelled) expired.value = result[props.data.path] === false;
  } catch {
    // silent
  }
});

onUnmounted(() => { cancelled = true; });

function downloadUrl() {
  return props.data.path && props.teamName ? getCloudResourceService().downloadUrl(props.data.path) : "#";
}
</script>

<template>
  <span v-if="expired" class="cloud-ref-card expired">
    <span class="cloud-ref-icon-fallback">{{ data.type === 'directory' ? '📁' : '📄' }}</span>
    <span v-if="data.type === 'file'" class="cloud-ref-info">
      <span class="cloud-ref-name">{{ data.name }}</span>
      <span class="cloud-ref-expired">({{ t('cloudMention.expired') }})</span>
    </span>
    <template v-else>
      <span class="cloud-ref-name">{{ data.name }}</span>
      <span class="cloud-ref-expired">({{ t('cloudMention.expired') }})</span>
    </template>
  </span>

  <a v-else-if="data.type === 'file'" class="cloud-ref-card file" :href="downloadUrl()" target="_blank" rel="noopener">
    <span class="cloud-ref-icon-fallback">📄</span>
    <span class="cloud-ref-info">
      <span class="cloud-ref-name">{{ data.name }}</span>
      <span class="cloud-ref-size">{{ formatFileSize(data.size ?? 0) }}</span>
    </span>
    <SvgIcon class="cloud-ref-download" name="download" :size="14" />
  </a>

  <span v-else class="cloud-ref-card directory" :data-cloud-path="data.path">
    <span class="cloud-ref-icon-fallback">📁</span>
    <span class="cloud-ref-name">{{ data.name }}</span>
    <span class="cloud-ref-action">{{ t('cloudMention.openInCloud') }}</span>
  </span>
</template>

<style scoped>
@import './styles.css';
</style>
