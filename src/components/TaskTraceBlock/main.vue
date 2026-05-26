<script setup lang="ts">
import type { TaskResource, AgentStep } from "../../types";
import { getTraceSteps, formatToolArgs, formatToolResult, AGENT_LABELS } from "../../utils/taskFormatters";
import SvgIcon from "../SvgIcon";

defineProps<{
  traces: TaskResource[];
  expanded: boolean;
  totalSteps?: number;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

function hasAgentStages(traces: TaskResource[]): boolean {
  return traces.some((t) => getTraceSteps(t).some((s) => s.agent));
}

function getAllSteps(traces: TaskResource[]): AgentStep[] {
  const steps: AgentStep[] = [];
  for (const t of traces) steps.push(...getTraceSteps(t));
  return steps;
}

interface AgentGroup {
  agent: string;
  attempts: Map<number, AgentStep[]>;
}

function groupByAgentAndAttempt(steps: AgentStep[]): AgentGroup[] {
  const map = new Map<string, Map<number, AgentStep[]>>();
  for (const step of steps) {
    const agentKey = step.agent ?? "";
    const attemptNum = step.attempt ?? 1;
    if (!map.has(agentKey)) map.set(agentKey, new Map());
    const attemptMap = map.get(agentKey)!;
    if (!attemptMap.has(attemptNum)) attemptMap.set(attemptNum, []);
    attemptMap.get(attemptNum)!.push(step);
  }
  const result: AgentGroup[] = [];
  for (const [agent, attempts] of map) {
    result.push({ agent, attempts });
  }
  return result;
}

function hasMultipleAttempts(group: AgentGroup): boolean {
  return group.attempts.size > 1;
}
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
      <!-- Pipeline mode: grouped by agent, then by attempt -->
      <template v-if="hasAgentStages(traces)">
        <template v-for="group in groupByAgentAndAttempt(getAllSteps(traces))" :key="group.agent">
          <div class="agent-stage-label">{{ AGENT_LABELS[group.agent] ?? group.agent }}</div>
          <template v-for="[attempt, steps] of group.attempts" :key="attempt">
            <div v-if="hasMultipleAttempts(group)" class="attempt-label">Attempt {{ attempt }}</div>
            <div v-for="step in steps" :key="`${attempt}-${step.index}`" class="trace-step">
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
        </template>
      </template>
      <!-- Legacy mode: grouped by member -->
      <template v-else>
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
      </template>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
