<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { getClientTaskQueue } from "../../composables/teamClientContext";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

const { queue, running, history, agentStep } = getClientTaskQueue();
const MAX_STEPS = 20;

const now = ref(Date.now());
let timer: number | undefined;

onMounted(() => {
  timer = window.setInterval(() => { now.value = Date.now(); }, 1000);
});

onUnmounted(() => {
  if (timer !== undefined) clearInterval(timer);
});

function formatElapsed(startedAt?: number): string {
  if (!startedAt) return "";
  const diff = Math.floor((now.value - startedAt) / 1000);
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}m ${diff % 60}s`;
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return "";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}
</script>

<template>
  <div class="queue-panel">
    <div class="queue-header">
      <span class="queue-title">{{ t('queue.title') }}</span>
      <span v-if="queue.length > 0 || running" class="queue-badge">
        {{ running ? 1 : 0 }}{{ queue.length ? `+${queue.length}` : '' }}
      </span>
    </div>

    <div class="queue-body">
      <!-- Running -->
      <template v-if="running">
        <div class="section-label">
          <span class="section-dot running" />
          {{ t('queue.running') }}
        </div>
        <div class="task-card running">
          <div class="task-content">{{ running.content }}</div>
          <div v-if="agentStep > 0" class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${Math.min((agentStep / MAX_STEPS) * 100, 100)}%` }"
            />
          </div>
          <div class="task-meta">
            <span class="step-info">{{ agentStep > 0 ? `Step ${agentStep} / ${MAX_STEPS}` : t('queue.starting') }}</span>
            <span class="elapsed">{{ formatElapsed(running.startedAt) }}</span>
          </div>
        </div>
      </template>

      <!-- Queued -->
      <template v-if="queue.length > 0">
        <div class="section-label">
          <span class="section-dot queued" />
          {{ t('queue.queued') }} ({{ queue.length }})
        </div>
        <div v-for="task in queue" :key="task.clientTaskId" class="task-card queued">
          <span class="task-content">{{ task.content }}</span>
        </div>
      </template>

      <!-- Recent -->
      <template v-if="history.length > 0">
        <div class="section-label">
          <span class="section-dot recent" />
          {{ t('queue.recent') }}
        </div>
        <div
          v-for="task in history"
          :key="task.clientTaskId"
          class="task-card"
          :class="task.status"
        >
          <span class="task-status-icon">{{ task.status === 'completed' ? '✓' : task.status === 'failed' ? '✗' : '○' }}</span>
          <span class="task-content">{{ task.content }}</span>
          <span class="task-duration">{{ formatDuration(task.duration) }}</span>
          <div v-if="task.error" class="task-error">{{ task.error }}</div>
        </div>
      </template>

      <!-- Empty -->
      <div v-if="!running && queue.length === 0 && history.length === 0" class="queue-empty">
        <SvgIcon name="circle" :size="24" />
        <span>{{ t('queue.empty') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
