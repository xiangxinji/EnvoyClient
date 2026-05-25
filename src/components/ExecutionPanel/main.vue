<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useExecutionMonitor } from "../../composables/useExecutionMonitor";
import { AGENT_LABELS, formatToolArgs, formatToolResult } from "../../utils/taskFormatters";
import SvgIcon from "../SvgIcon";
import type { ExecutionEntry } from "../../types";

const { t } = useI18n();
const { status, taskInfo, currentStage, entries } = useExecutionMonitor();

const scrollContainer = ref<HTMLElement | null>(null);

const isIdle = computed(() => status.value === "idle");
const isDone = computed(() => status.value === "done");

interface StageGroup {
  stage: string;
  entries: ExecutionEntry[];
}

const groupedEntries = computed<StageGroup[]>(() => {
  const groups: StageGroup[] = [];
  let current: StageGroup | null = null;
  for (const entry of entries.value) {
    const evt = entry.event;
    const stage = "stage" in evt ? (evt as { stage: string }).stage : "";
    if (stage && (!current || current.stage !== stage)) {
      if (evt.type === "stage:start" || evt.type === "step:reasoning" || evt.type === "step:tool_call" || evt.type === "step:tool_result") {
        current = { stage, entries: [] };
        groups.push(current);
      }
    }
    if (current && (evt.type === "step:reasoning" || evt.type === "step:tool_call" || evt.type === "step:tool_result")) {
      current.entries.push(entry);
    }
  }
  return groups;
});

function isStageComplete(stage: string): boolean {
  return entries.value.some(
    (e) => e.event.type === "stage:end" && (e.event as { stage: string }).stage === stage,
  );
}

function isStageActive(stage: string): boolean {
  return currentStage.value === stage && !isStageComplete(stage);
}

watch(
  () => entries.value.length,
  () => {
    nextTick(() => {
      const el = scrollContainer.value;
      if (el) el.scrollTop = el.scrollHeight;
    });
  },
);
</script>

<template>
  <div class="execution-panel">
    <div class="panel-header">
      <SvgIcon name="terminal" :size="16" />
      <span>{{ t('execution.title') }}</span>
    </div>

    <div v-if="isIdle" class="empty-state">
      <SvgIcon name="terminal" :size="32" />
      <p>{{ t('execution.empty') }}</p>
    </div>

    <div v-else class="execution-content" ref="scrollContainer">
      <div v-if="taskInfo" class="task-info">
        <div class="task-info-id">#{{ taskInfo.taskId }}</div>
        <div class="task-info-content">{{ taskInfo.taskContent }}</div>
      </div>

      <div v-if="isDone" class="execution-done">
        <SvgIcon name="check-circle" :size="14" />
        {{ t('execution.completed') }}
      </div>

      <div v-for="group in groupedEntries" :key="group.stage" class="stage-group">
        <div class="stage-header" :class="{ active: isStageActive(group.stage), done: isStageComplete(group.stage) }">
          <span class="stage-indicator">
            <SvgIcon v-if="isStageComplete(group.stage)" name="check-circle" :size="12" />
            <SvgIcon v-else-if="isStageActive(group.stage)" name="spinner" :size="12" />
            <span v-else class="stage-dot"></span>
          </span>
          {{ AGENT_LABELS[group.stage] ?? group.stage }}
        </div>
        <div class="stage-entries">
          <template v-for="(entry, i) in group.entries" :key="i">
            <div v-if="entry.event.type === 'step:reasoning'" class="entry-reasoning">
              <span class="entry-step">Step {{ entry.event.stepIndex }}</span>
              <p>{{ entry.event.reasoning }}</p>
            </div>
            <div v-else-if="entry.event.type === 'step:tool_call'" class="entry-tool-call">
              <span class="tool-label">{{ entry.event.toolName }}</span>
              <code class="tool-args">{{ formatToolArgs(entry.event.args) }}</code>
            </div>
            <div v-else-if="entry.event.type === 'step:tool_result'" class="entry-tool-result">
              <pre>{{ formatToolResult(entry.event.result) }}</pre>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
