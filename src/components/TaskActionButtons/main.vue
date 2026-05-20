<script setup lang="ts">
import SvgIcon from "../SvgIcon";

defineProps<{
  isAssignedToMe: boolean | string | undefined;
  canStart: boolean | string | undefined;
  canUpload: boolean | string | undefined;
  canComplete: boolean | string | undefined;
  canReview: boolean | string | undefined;
  starting: boolean;
  uploading: boolean;
  completing: boolean;
  reviewing: boolean;
}>();

const emit = defineEmits<{
  start: [];
  upload: [];
  complete: [];
  approve: [];
  reject: [];
}>();
</script>

<template>
  <div v-if="isAssignedToMe && (canStart || canUpload || canComplete)" class="task-actions" @click.stop>
    <button v-if="canStart" class="action-btn action-start" :disabled="starting" @click="emit('start')">
      <SvgIcon name="play" :size="12" />
      {{ starting ? $t('task.starting') : $t('task.startExecution') }}
    </button>
    <button v-if="canUpload" class="action-btn action-upload" :disabled="uploading" @click="emit('upload')">
      <SvgIcon name="upload" :size="12" />
      {{ uploading ? $t('task.uploading') : $t('task.uploadFile') }}
    </button>
    <button v-if="canComplete" class="action-btn action-complete" :disabled="completing" @click="emit('complete')">
      <SvgIcon name="check" :size="12" />
      {{ completing ? $t('task.submitting') : $t('task.markComplete') }}
    </button>
  </div>

  <div v-if="canReview" class="task-actions" @click.stop>
    <button class="action-btn action-approve" :disabled="reviewing" @click="emit('approve')">
      <SvgIcon name="check" :size="12" />
      {{ reviewing ? $t('task.processing') : $t('task.approve') }}
    </button>
    <button class="action-btn action-reject" :disabled="reviewing" @click="emit('reject')">
      <SvgIcon name="close" :size="12" />
      {{ $t('task.reject') }}
    </button>
  </div>
</template>
