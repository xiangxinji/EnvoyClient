<script setup lang="ts">
import type { TaskResource } from "../../types";
import { getTraceSteps, formatToolArgs, formatToolResult } from "../../utils/taskFormatters";
import SvgIcon from "../SvgIcon";

defineProps<{
  traces: TaskResource[];
  expanded: boolean;
  totalSteps?: number;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <div v-if="traces.length > 0" class="task-section">
    <div class="section-label clickable" @click.stop="emit('toggle')">
      <SvgIcon name="activity" :size="13" />
      {{ $t('task.executionTrace') }}
      <span v-if="totalSteps !== undefined" class="trace-count">{{ $t('task.steps', { count: totalSteps }) }}</span>
      <span class="trace-toggle">{{ expanded ? $t('task.collapse') : $t('task.expand') }}</span>
    </div>
    <div v-if="expanded" class="trace-timeline">
      <template v-for="trace in traces" :key="trace.by">
        <div v-if="traces.length > 1" class="trace-member-label">{{ trace.by }}</div>
        <div v-for="step in getTraceSteps(trace)" :key="step.index" class="trace-step">
          <div class="trace-step-header">
            <span class="step-index">Step {{ step.index }}</span>
            <span v-if="step.toolCalls.length > 0" class="step-tools">
              <span v-for="(tc, ti) in step.toolCalls" :key="ti" class="tool-tag">{{ tc.name }}</span>
            </span>
          </div>
          <div v-if="step.reasoning" class="step-reasoning">{{ step.reasoning }}</div>
          <div v-if="step.toolCalls.length > 0" class="step-details">
            <div v-for="(tc, ti) in step.toolCalls" :key="ti" class="tool-call-block">
              <div class="tool-call-header">
                <span class="tool-name">{{ tc.name }}</span>
                <code class="tool-args">{{ formatToolArgs(tc.args) }}</code>
              </div>
              <div v-if="step.toolResults[ti]" class="tool-result">
                <pre class="tool-result-content">{{ formatToolResult(step.toolResults[ti].result) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
