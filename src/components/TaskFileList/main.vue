<script setup lang="ts">
import type { TypedTaskResource } from "../../composables/useTaskResources";
import type { FileResourceData } from "../../types";
import { formatFileSize, formatTimestamp } from "../../utils/taskFormatters";
import SvgIcon from "../SvgIcon";

defineProps<{
  files: TypedTaskResource<FileResourceData>[];
  downloading: string | null;
}>();

const emit = defineEmits<{
  download: [filename: string];
}>();
</script>

<template>
  <div v-if="files.length > 0" class="task-section">
    <div class="section-label">
      <SvgIcon name="file-plus" :size="13" />
      {{ $t('task.uploadFile') }}
    </div>
    <div v-for="(res, i) in files" :key="`file-${i}`" class="file-item">
      <span class="resource-by">{{ res.by }}</span>
      <a
        class="file-link"
        :class="{ disabled: downloading === res.data.filename }"
        href="javascript:void(0)"
        @click.stop="emit('download', res.data.filename)"
      >
        <template v-if="downloading === res.data.filename">
          <SvgIcon name="spinner" :size="12" class="spin" />
          {{ $t('task.downloading') }}
        </template>
        <template v-else>
          <SvgIcon name="download" :size="12" />
          {{ res.data.filename }}
        </template>
      </a>
      <span class="file-meta">{{ formatFileSize(res.data.size) }} · {{ formatTimestamp(res.data.uploadedAt) }}</span>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
