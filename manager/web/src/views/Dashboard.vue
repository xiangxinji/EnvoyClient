<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { api, type DashboardData } from "../api";

const data = ref<DashboardData | null>(null);
const loading = ref(true);
const error = ref("");
let timer: ReturnType<typeof setInterval>;

async function refresh() {
  try {
    data.value = await api.getDashboard();
    error.value = "";
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  refresh();
  timer = setInterval(refresh, 5000);
});

onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="dashboard">
    <h1 class="page-title">概览</h1>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="data">
      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-value">{{ data.totalTeams }}</div>
          <div class="stat-label">团队</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data.totalOnline }}</div>
          <div class="stat-label">在线成员</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data.totalTasks }}</div>
          <div class="stat-label">总任务</div>
        </div>
      </div>

      <div class="task-breakdown">
        <h2 class="section-title">任务统计</h2>
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="dot pending"></span>
            <span class="breakdown-label">等待中</span>
            <span class="breakdown-value">{{ data.taskSummary.pending ?? 0 }}</span>
          </div>
          <div class="breakdown-item">
            <span class="dot running"></span>
            <span class="breakdown-label">执行中</span>
            <span class="breakdown-value">{{ data.taskSummary.running ?? 0 }}</span>
          </div>
          <div class="breakdown-item">
            <span class="dot completed"></span>
            <span class="breakdown-label">已完成</span>
            <span class="breakdown-value">{{ data.taskSummary.completed ?? 0 }}</span>
          </div>
          <div class="breakdown-item">
            <span class="dot failed"></span>
            <span class="breakdown-label">失败</span>
            <span class="breakdown-value">{{ data.taskSummary.failed ?? 0 }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 900px;
}

.page-title {
  font-size: 1.4em;
  font-weight: 700;
  margin-bottom: var(--space-xl);
}

.loading, .error {
  color: var(--text-muted);
  padding: var(--space-xl);
}

.error {
  color: var(--error);
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
  margin-bottom: var(--space-2xl);
}

.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

.stat-value {
  font-size: 2em;
  font-weight: 700;
  color: var(--accent);
}

.stat-label {
  font-size: 0.85em;
  color: var(--text-muted);
  margin-top: var(--space-xs);
}

.section-title {
  font-size: 1em;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--text-secondary);
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.breakdown-item {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  box-shadow: var(--shadow-sm);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.pending { background: var(--status-pending); }
.dot.running { background: var(--status-running); }
.dot.completed { background: var(--status-completed); }
.dot.failed { background: var(--status-failed); }

.breakdown-label {
  font-size: 0.85em;
  color: var(--text-secondary);
  flex: 1;
}

.breakdown-value {
  font-weight: 600;
  font-size: 0.95em;
}
</style>
