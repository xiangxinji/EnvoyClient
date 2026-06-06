<script setup lang="ts">
import SvgIcon from "../SvgIcon";

defineProps<{
  label: string;
  desc: string;
  shortcut: string;
  isRecording: boolean;
}>();

defineEmits<{
  record: [];
  clear: [];
}>();
</script>

<template>
  <div class="shortcut-card">
    <div class="shortcut-info">
      <span class="shortcut-label">{{ label }}</span>
      <span class="shortcut-desc">{{ desc }}</span>
    </div>
    <div class="shortcut-actions">
      <button
        class="key-badge"
        :class="{ recording: isRecording }"
        @click="$emit('record')"
      >
        <template v-if="isRecording">
          <span class="recording-dot" />
          {{ $t('shortcut.pressing') }}
        </template>
        <template v-else-if="shortcut">
          {{ shortcut }}
        </template>
        <template v-else>
          {{ $t('shortcut.clickToRecord') }}
        </template>
      </button>
      <button
        v-if="shortcut && !isRecording"
        class="clear-btn"
        :title="$t('shortcut.clearShortcut')"
        @click="$emit('clear')"
      >
        <SvgIcon name="close" :size="12" />
      </button>
    </div>
  </div>
</template>
