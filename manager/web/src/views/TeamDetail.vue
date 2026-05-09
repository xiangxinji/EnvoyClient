<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { api, type MemberInfo, type TaskInfo } from "../api";
import MemberTable from "../components/MemberTable.vue";
import TaskTable from "../components/TaskTable.vue";

const props = defineProps<{ name: string }>();

const members = ref<MemberInfo[]>([]);
const tasks = ref<TaskInfo[]>([]);
const loading = ref(true);
const error = ref("");
let timer: ReturnType<typeof setInterval>;

async function refresh() {
  try {
    const [m, t] = await Promise.all([
      api.getMembers(props.name),
      api.getTasks(props.name),
    ]);
    members.value = m;
    tasks.value = t;
    error.value = "";
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

watch(() => props.name, refresh);

onMounted(() => {
  refresh();
  timer = setInterval(refresh, 5000);
});

onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="detail">
    <div class="detail-header">
      <h1 class="page-title">{{ name }}</h1>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <section class="section">
        <h2 class="section-title">成员 ({{ members.length }})</h2>
        <MemberTable :members="members" />
      </section>

      <section class="section">
        <h2 class="section-title">任务 ({{ tasks.length }})</h2>
        <TaskTable :tasks="tasks" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.detail {
  width: 100%;
}

.detail-header {
  margin-bottom: var(--space-xl);
}

.page-title {
  font-size: 1.4em;
  font-weight: 700;
}

.loading, .error {
  color: var(--text-muted);
  padding: var(--space-xl);
}

.error {
  color: var(--error);
}

.section {
  margin-bottom: var(--space-2xl);
}

.section-title {
  font-size: 1em;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--text-secondary);
}
</style>
