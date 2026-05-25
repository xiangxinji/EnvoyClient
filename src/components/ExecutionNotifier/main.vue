<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useExecutionMonitor } from "../../composables/useExecutionMonitor";
import SvgIcon from "../SvgIcon";

const emit = defineEmits<{
  navigate: [peerId: string];
}>();

const { t } = useI18n();
const { status, taskInfo } = useExecutionMonitor();

const visible = computed(() => status.value === "running");

function handleClick() {
  emit("navigate", "__execution__");
}
</script>

<template>
  <Transition name="notifier">
    <div v-if="visible" class="execution-notifier" @click="handleClick">
      <SvgIcon name="spinner" :size="14" class="notifier-spinner" />
      <div class="notifier-text">
        <span class="notifier-label">{{ t('execution.notifierRunning') }}</span>
        <span v-if="taskInfo" class="notifier-task">#{{ taskInfo.taskId }}</span>
      </div>
      <SvgIcon name="chevron-right" :size="12" class="notifier-arrow" />
    </div>
  </Transition>
</template>

<style scoped>
@import './styles.css';
</style>
