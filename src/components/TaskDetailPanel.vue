<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { marked, type Tokens } from "marked";
import DOMPurify from "dompurify";
import type { TaskMessage, TaskResource, AgentStep } from "../types";
import type { Task } from "../../envoy/packages/core/task.js";
import { apiUrl, managerFetch, managerPost } from "../api";
import { inject } from "vue";
import { TeamClientKey } from "../composables/teamClientContext";
import ConfirmDialog from "./ConfirmDialog.vue";
import Toast from "./Toast.vue";
import BackButton from "./BackButton.vue";

marked.setOptions({ gfm: true, breaks: true });

const linkRenderer = {
  link({ href, title, text }: Tokens.Link) {
    const titleAttr = title ? ` title="${title}"` : "";
    return `<a target="_blank" rel="noopener noreferrer" href="${href}"${titleAttr}>${text}</a>`;
  },
};
marked.use({ renderer: linkRenderer });

const ctx = inject(TeamClientKey)!;

const props = defineProps<{
  task: TaskMessage;
  teamName?: string;
  myId?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

// Maintain a fresh copy of the task by fetching from API + listening to WebSocket
const liveTask = ref<TaskMessage>({ ...props.task });

async function fetchTask() {
  try {
    const res = await managerFetch(`/api/teams/${encodeURIComponent(ctx.teamName)}/tasks/${liveTask.value.taskId}`);
    if (!res.ok) return;
    const t = await res.json() as Record<string, unknown>;
    liveTask.value = {
      type: "task",
      id: `task-${t.id}`,
      seq: 0,
      taskId: t.id as string,
      from: t.createBy as string,
      content: t.content as string,
      status: t.status as TaskMessage["status"],
      resources: t.resources as TaskResource[],
      subscribe: t.subscribe as string[],
      timestamp: t.createdAt as number,
    };
  } catch { /* ignore */ }
}

function onTaskUpdate(task: Task) {
  if (task.id === liveTask.value.taskId) {
    liveTask.value = {
      type: "task",
      id: `task-${task.id}`,
      seq: 0,
      taskId: task.id,
      from: task.createBy,
      content: task.content,
      status: task.status,
      resources: task.resources as TaskResource[],
      subscribe: task.subscribe,
      timestamp: task.createdAt,
    };
  }
}

onMounted(async () => {
  await fetchTask();
  ctx.client?.on("task", onTaskUpdate);
});

onUnmounted(() => {
  ctx.client?.off("task", onTaskUpdate);
});

const statusLabels: Record<TaskMessage["status"], string> = {
  pending: "等待中",
  running: "执行中",
  reviewing: "审查中",
  completed: "已完成",
  failed: "失败",
};

const modeLabels: Record<string, string> = {
  serial: "串行",
  parallel: "并行",
};

// ─── Group resources by type ───

const clientResults = computed<TaskResource[]>(() =>
  liveTask.value.resources?.filter((r) => r.type === "client-result") ?? []
);

const fileResources = computed<TaskResource[]>(() =>
  liveTask.value.resources?.filter((r) => r.type === "file-resource") ?? []
);

const traceResources = computed<TaskResource[]>(() =>
  liveTask.value.resources?.filter((r) => r.type === "execution-trace") ?? []
);

const leaderReviews = computed<TaskResource[]>(() =>
  liveTask.value.resources?.filter((r) => r.type === "leader-review") ?? []
);

const traceByMember = computed(() => {
  const map = new Map<string, boolean>();
  for (const r of traceResources.value) {
    map.set(r.by, true);
  }
  return map;
});

function isAIExecuted(res: TaskResource): boolean {
  if ((res.data as Record<string, unknown>)?.source === "ai") return true;
  return traceByMember.value.has(res.by);
}

// ─── Timeline ───

interface TimelineEvent {
  time: number | undefined;
  label: string;
  by: string;
  icon: "create" | "result" | "review" | "file";
  success?: boolean;
}

const timelineEvents = computed<TimelineEvent[]>(() => {
  const events: TimelineEvent[] = [];

  events.push({
    time: liveTask.value.timestamp,
    label: "创建任务",
    by: liveTask.value.from,
    icon: "create",
  });

  for (const r of clientResults.value) {
    events.push({
      time: r.timestamp,
      label: "执行完成",
      by: r.by,
      icon: "result",
    });
  }

  for (const r of leaderReviews.value) {
    const success = (r.data as Record<string, unknown>)?.success as boolean;
    events.push({
      time: r.timestamp,
      label: success ? "审核通过" : "审核驳回",
      by: r.by,
      icon: "review",
      success,
    });
  }

  for (const r of fileResources.value) {
    events.push({
      time: r.timestamp,
      label: "上传文件",
      by: r.by,
      icon: "file",
    });
  }

  events.sort((a, b) => {
    if (a.time !== undefined && b.time !== undefined) return a.time - b.time;
    if (a.time !== undefined) return -1;
    if (b.time !== undefined) return 1;
    return 0;
  });

  return events;
});

// ─── Duration ───

const duration = computed<string | null>(() => {
  if (!liveTask.value.timestamp) return null;
  const lastTs = timelineEvents.value.filter((e) => e.time !== undefined).pop()?.time;
  if (!lastTs) return null;
  const diff = lastTs - liveTask.value.timestamp;
  if (diff <= 0) return null;
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
});

// ─── Member entries ───

interface MemberEntry {
  id: string;
  hasResult: boolean;
}

const memberEntries = computed<MemberEntry[]>(() => {
  const resultMemberIds = new Set(clientResults.value.map((r) => r.by));

  if (clientResults.value.length > 0) {
    const entries: MemberEntry[] = clientResults.value.map((r) => ({
      id: r.by,
      hasResult: true,
    }));
    for (const id of liveTask.value.subscribe ?? []) {
      if (!resultMemberIds.has(id)) {
        entries.push({ id, hasResult: false });
      }
    }
    return entries;
  }

  if (liveTask.value.subscribe?.length) {
    return liveTask.value.subscribe.map((id) => ({ id, hasResult: false }));
  }

  return [];
});

// ─── Permissions ───

const isAssignedToMe = computed(() => {
  return props.myId && (liveTask.value.subscribe ?? []).includes(props.myId);
});

const isCreatedByMe = computed(() => {
  return props.myId && liveTask.value.from === props.myId;
});

const canStart = computed(() => isAssignedToMe.value && liveTask.value.status === "pending");
const canComplete = computed(() => isAssignedToMe.value && liveTask.value.status === "running");
const canUpload = computed(() => isAssignedToMe.value && (liveTask.value.status === "running" || liveTask.value.status === "pending"));
const canReview = computed(() => isCreatedByMe.value && liveTask.value.status === "reviewing");

// ─── ConfirmDialog state ───

const confirmVisible = ref(false);
const confirmTitle = ref("确认");
const confirmMessage = ref("");
const confirmDanger = ref(false);
const pendingAction = ref<(() => void) | null>(null);

function showConfirm(title: string, message: string, action: () => void, danger = false) {
  confirmTitle.value = title;
  confirmMessage.value = message;
  confirmDanger.value = danger;
  pendingAction.value = action;
  confirmVisible.value = true;
}

function onConfirm() {
  confirmVisible.value = false;
  pendingAction.value?.();
  pendingAction.value = null;
}

function onCancel() {
  confirmVisible.value = false;
  pendingAction.value = null;
}

// ─── Toast state ───

const toastVisible = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error" | "info">("info");

function showToast(message: string, type: "success" | "error" | "info" = "info") {
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;
}

function onToastDone() {
  toastVisible.value = false;
}

// ─── Task operations ───

const starting = ref(false);
const completing = ref(false);
const uploading = ref(false);
const reviewing = ref(false);

async function handleStart() {
  if (starting.value) return;
  starting.value = true;
  try {
    const res = await managerPost(`/api/tasks/${liveTask.value.taskId}/start`, { from: props.myId }, { team: props.teamName ?? "" });
    if (res.ok) { /* WebSocket will update */ }
    else showToast("操作失败", "error");
  } catch {
    showToast("操作失败", "error");
  }
  starting.value = false;
}

function requestComplete() {
  showConfirm("确认完成", "确定要标记此任务为完成吗？", doComplete);
}

async function doComplete() {
  if (completing.value) return;
  completing.value = true;
  try {
    const res = await managerPost(`/api/tasks/${liveTask.value.taskId}/complete`, { from: props.myId, data: { note: "手动标记完成", source: "manual" } }, { team: props.teamName ?? "" });
    if (res.ok) { /* WebSocket will update */ }
    else showToast("操作失败", "error");
  } catch {
    showToast("操作失败", "error");
  }
  completing.value = false;
}

function requestApprove() {
  showConfirm("确认通过", "确定要通过此任务的审查吗？", doApprove);
}

async function doApprove() {
  if (reviewing.value) return;
  reviewing.value = true;
  try {
    const res = await managerPost(`/api/tasks/${liveTask.value.taskId}/result`, {
      from: props.myId,
      success: true,
      data: { review: "通过", source: "manual" },
    }, { team: props.teamName ?? "" });
    if (res.ok) {
      showToast("审查已通过", "success");
    } else {
      showToast("操作失败", "error");
    }
  } catch {
    showToast("操作失败", "error");
  }
  reviewing.value = false;
}

function requestReject() {
  showConfirm("确认驳回", "确定要驳回此任务吗？驳回后任务将重新分派给所有成员。", doReject, true);
}

async function doReject() {
  if (reviewing.value) return;
  reviewing.value = true;
  try {
    const res = await managerPost(`/api/tasks/${liveTask.value.taskId}/result`, {
      from: props.myId,
      success: false,
      error: "未通过审查",
    }, { team: props.teamName ?? "" });
    if (res.ok) {
      showToast("任务已驳回，将重新分派", "info");
    } else {
      showToast("操作失败", "error");
    }
  } catch {
    showToast("操作失败", "error");
  }
  reviewing.value = false;
}

async function handleUpload() {
  const input = document.createElement("input");
  input.type = "file";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    uploading.value = true;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("from", props.myId ?? "");
      const res = await fetch(apiUrl(`/api/tasks/${liveTask.value.taskId}/resources`), {
        method: "POST",
        headers: { team: props.teamName ?? "" },
        body: formData,
      });
      if (!res.ok) throw new Error("上传失败");
      /* WebSocket will update */
    } catch {
      showToast("文件上传失败", "error");
    }
    uploading.value = false;
  };
  input.click();
}

// ─── Helpers ───

function getResultText(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if ("result" in obj) {
      const val = obj.result;
      return typeof val === "string" ? val : JSON.stringify(val, null, 2);
    }
    if ("error" in obj) return `**Error:** ${obj.error}`;
  }
  return JSON.stringify(data, null, 2);
}

function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text) as string);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatTime(ts: number | undefined): string {
  if (ts === undefined) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getFileDownloadUrl(filename: string): string {
  return apiUrl(`/api/tasks/${liveTask.value.taskId}/resources/${encodeURIComponent(filename)}`);
}

async function downloadFile(filename: string) {
  try {
    const url = getFileDownloadUrl(filename);
    const res = await fetch(url, { headers: { team: props.teamName ?? "" } });
    if (!res.ok) throw new Error("下载失败");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    showToast("文件下载失败", "error");
  }
}

function getTraceSteps(traceRes: TaskResource): AgentStep[] {
  const data = traceRes.data as { steps?: AgentStep[] };
  return data?.steps ?? [];
}

function formatToolArgs(args: unknown): string {
  if (!args || typeof args !== "object") return String(args);
  const obj = args as Record<string, unknown>;
  if ("command" in obj) return String(obj.command);
  if ("path" in obj) return String(obj.path);
  return JSON.stringify(args);
}

function formatToolResult(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if ("stdout" in obj || "stderr" in obj) {
      const parts: string[] = [];
      if (obj.stdout) parts.push(String(obj.stdout));
      if (obj.stderr) parts.push(`[stderr] ${obj.stderr}`);
      return parts.join("\n");
    }
    if ("content" in obj) return String(obj.content);
    if ("ok" in obj && "path" in obj) return `uploaded: ${obj.path}`;
    if ("done" in obj) return String((result as Record<string, unknown>).result ?? "done");
  }
  return JSON.stringify(result);
}

// ─── Trace expand state ───
const traceExpanded = ref(false);

function toggleTrace(_by: string) {
  traceExpanded.value = !traceExpanded.value;
}

function isTraceExpanded(_by: string): boolean {
  return traceExpanded.value;
}
</script>

<template>
  <div class="detail-panel">
    <!-- Header -->
    <div class="detail-header">
      <span class="detail-title">任务详情</span>
      <BackButton @click="emit('close')" />
    </div>

    <div class="detail-body">
      <!-- Status + Meta -->
      <div class="detail-meta-row">
        <span class="status-badge" :class="liveTask.status">{{ statusLabels[liveTask.status] }}</span>
        <span class="mode-badge">{{ modeLabels['serial'] ?? '串行' }}</span>
      </div>

      <div class="detail-content">{{ liveTask.content }}</div>

      <div class="detail-info-grid">
        <div class="info-item">
          <span class="info-label">创建者</span>
          <span class="info-value">{{ liveTask.from }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">创建时间</span>
          <span class="info-value">{{ formatTimestamp(liveTask.timestamp) }}</span>
        </div>
        <div v-if="duration" class="info-item">
          <span class="info-label">耗时</span>
          <span class="info-value">{{ duration }}</span>
        </div>
      </div>

      <!-- Timeline -->
      <div class="detail-section">
        <div class="section-title">事件时间线</div>
        <div class="timeline">
          <div v-for="(evt, i) in timelineEvents" :key="i" class="timeline-item">
            <div class="timeline-dot" :class="evt.icon">
              <svg v-if="evt.icon === 'create'" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>
              <svg v-else-if="evt.icon === 'result'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              <svg v-else-if="evt.icon === 'review'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 11l3 3L22 4"/></svg>
              <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            </div>
            <div class="timeline-content">
              <span class="timeline-label">{{ evt.label }}</span>
              <span class="timeline-by">{{ evt.by }}</span>
              <span v-if="evt.time !== undefined" class="timeline-time">{{ formatTime(evt.time) }}</span>
              <span v-if="evt.success === false" class="timeline-reject">驳回</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Member results grouped -->
      <div v-if="memberEntries.length > 0" class="detail-section">
        <div class="section-title">成员执行</div>
        <div class="member-results">
          <div v-for="entry in memberEntries" :key="entry.id" class="member-block">
            <div class="member-block-header">
              <span class="member-id">{{ entry.id }}</span>
              <span v-if="entry.hasResult" class="member-status completed">已完成</span>
              <span v-else class="member-status pending">待执行</span>
            </div>

            <!-- Client result -->
            <template v-if="entry.hasResult">
              <div v-for="res in clientResults.filter(r => r.by === entry.id)" :key="res.by" class="result-block">
                <span v-if="isAIExecuted(res)" class="source-badge ai">AI</span>
                <span v-else class="source-badge manual">手动</span>
                <div class="markdown-content" v-html="renderMarkdown(getResultText(res.data))" />
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Execution traces (standalone section, like TaskCard) -->
      <div v-if="traceResources.length > 0" class="detail-section">
        <div class="section-title clickable" @click="toggleTrace('__all__')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          执行过程
          <span class="trace-count">{{ traceResources.map(r => getTraceSteps(r).length).reduce((a, b) => a + b, 0) }} 步</span>
          <span class="trace-expand">{{ isTraceExpanded('__all__') ? '收起' : '展开' }}</span>
        </div>
        <template v-if="isTraceExpanded('__all__')">
          <div v-for="trace in traceResources" :key="trace.by" class="trace-member-block">
            <div class="trace-member-label">{{ trace.by }}</div>
            <div class="trace-steps">
              <div v-for="step in getTraceSteps(trace)" :key="step.index" class="trace-step">
                <div class="trace-step-header">
                  <span class="step-index">Step {{ step.index }}</span>
                  <span v-for="(tc, ti) in step.toolCalls" :key="ti" class="tool-tag">{{ tc.name }}</span>
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
            </div>
          </div>
        </template>
      </div>

      <!-- Leader reviews -->
      <div v-if="leaderReviews.length > 0" class="detail-section">
        <div class="section-title">审查记录</div>
        <div v-for="(review, i) in leaderReviews" :key="`review-${i}`" class="review-item" :class="(review.data as Record<string, unknown>)?.success ? 'approved' : 'rejected'">
          <span class="resource-by">{{ review.by }}</span>
          <span class="review-status" :class="(review.data as Record<string, unknown>)?.success ? 'approved' : 'rejected'">
            {{ (review.data as Record<string, unknown>)?.success ? '通过' : '驳回' }}
          </span>
          <div v-if="(review.data as Record<string, unknown>)?.data" class="review-data">
            <div class="markdown-content" v-html="renderMarkdown(getResultText((review.data as Record<string, unknown>).data))" />
          </div>
          <div v-if="(review.data as Record<string, unknown>)?.error" class="review-error">{{ (review.data as Record<string, unknown>)?.error }}</div>
        </div>
      </div>

      <!-- File resources -->
      <div v-if="fileResources.length > 0" class="detail-section">
        <div class="section-title">资源文件</div>
        <div v-for="(res, i) in fileResources" :key="`file-${i}`" class="file-item">
          <span class="resource-by">{{ res.by }}</span>
          <a class="file-link" href="javascript:void(0)" @click="downloadFile((res.data as Record<string, unknown>).filename as string)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {{ (res.data as Record<string, unknown>).filename }}
          </a>
          <span class="file-meta">{{ formatFileSize((res.data as Record<string, unknown>).size as number) }} · {{ formatTimestamp((res.data as Record<string, unknown>).uploadedAt as number) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="isAssignedToMe && (canStart || canUpload || canComplete)" class="detail-actions">
        <button v-if="canStart" class="action-btn action-start" :disabled="starting" @click="handleStart">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          {{ starting ? '执行中...' : '开始执行' }}
        </button>
        <button v-if="canUpload" class="action-btn action-upload" :disabled="uploading" @click="handleUpload">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          {{ uploading ? '上传中...' : '上传文件' }}
        </button>
        <button v-if="canComplete" class="action-btn action-complete" :disabled="completing" @click="requestComplete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          {{ completing ? '提交中...' : '标记完成' }}
        </button>
      </div>

      <div v-if="canReview" class="detail-actions">
        <button class="action-btn action-approve" :disabled="reviewing" @click="requestApprove">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          {{ reviewing ? '处理中...' : '通过' }}
        </button>
        <button class="action-btn action-reject" :disabled="reviewing" @click="requestReject">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          驳回
        </button>
      </div>
    </div>

    <ConfirmDialog
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :danger="confirmDanger"
      @confirm="onConfirm"
      @cancel="onCancel"
    />
    <Toast
      :visible="toastVisible"
      :message="toastMessage"
      :type="toastType"
      @done="onToastDone"
    />
  </div>
</template>

<style scoped>
.detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
}

.detail-header {
  position: relative;
  z-index: 10;
  height: 52px;
  box-sizing: border-box;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.detail-title {
  font-weight: 600;
  color: var(--text-primary);
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

/* Meta row */
.detail-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.status-badge {
  font-size: 0.75em;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.status-badge.pending { background: var(--task-pending-bg); color: var(--task-pending-text); }
.status-badge.running { background: var(--task-running-bg); color: var(--task-running-text); }
.status-badge.reviewing { background: var(--task-reviewing-bg); color: var(--task-reviewing-text); }
.status-badge.completed { background: var(--task-completed-bg); color: var(--task-completed-text); }
.status-badge.failed { background: var(--task-failed-bg); color: var(--task-failed-text); }

.mode-badge {
  font-size: 0.7em;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.detail-content {
  font-size: 0.95em;
  line-height: 1.5;
  color: var(--text-primary);
}

/* Info grid */
.detail-info-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md) var(--space-xl);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 0.7em;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.info-value {
  font-size: 0.82em;
  color: var(--text-secondary);
}

/* Sections */
.detail-section {
  border-top: 1px solid var(--border-light);
  padding-top: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.section-title {
  font-size: 0.78em;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: var(--space-xs);
}

.section-title.clickable {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  user-select: none;
}

.section-title.clickable:hover {
  color: var(--accent);
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
  position: relative;
}

.timeline-item:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 18px;
  bottom: -4px;
  width: 1px;
  background: var(--border);
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.timeline-dot.create { color: var(--text-muted); }
.timeline-dot.result { color: var(--task-completed-text); }
.timeline-dot.review { color: var(--task-reviewing-text); }
.timeline-dot.file { color: var(--text-secondary); }

.timeline-content {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-xs);
  font-size: 0.82em;
}

.timeline-label { font-weight: 500; color: var(--text-primary); }
.timeline-by { color: var(--accent); font-size: 0.9em; }
.timeline-time { color: var(--text-muted); font-size: 0.85em; }
.timeline-reject { color: var(--task-failed-text); font-size: 0.85em; font-weight: 500; }

/* Member results */
.member-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.member-block {
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
}

.member-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}

.member-id {
  font-size: 0.82em;
  font-weight: 600;
  color: var(--accent);
}

.member-status {
  font-size: 0.7em;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.member-status.completed { background: var(--task-completed-bg); color: var(--task-completed-text); }
.member-status.pending { background: var(--task-pending-bg); color: var(--task-pending-text); }

.result-block {
  margin-top: var(--space-xs);
}

/* Source badges */
.source-badge {
  font-size: 0.65em;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.3px;
  line-height: 1;
  display: inline-block;
  margin-bottom: var(--space-xs);
}

.source-badge.ai { background: var(--accent-light); color: var(--accent); }
.source-badge.manual { background: var(--bg-tertiary); color: var(--text-muted); }

/* Markdown */
.markdown-content {
  font-size: 0.85em;
  line-height: 1.45;
  word-break: break-word;
}

.markdown-content :deep(p) { margin: 0 0 0.4em; }
.markdown-content :deep(p:last-child) { margin-bottom: 0; }
.markdown-content :deep(strong) { font-weight: 600; }
.markdown-content :deep(code) {
  font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
  font-size: 0.88em;
  background: var(--md-code-bg);
  color: var(--md-code-text);
  padding: 1px 5px;
  border-radius: 4px;
}
.markdown-content :deep(pre) {
  margin: 0.5em 0;
  padding: 10px 12px;
  background: var(--md-pre-bg);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}
.markdown-content :deep(pre code) {
  background: none;
  color: var(--md-pre-text);
  padding: 0;
}

/* Review */
.review-item {
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-xs);
}

.review-status {
  font-size: 0.72em;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}
.review-status.approved { background: var(--task-completed-bg); color: var(--task-completed-text); }
.review-status.rejected { background: var(--task-failed-bg); color: var(--task-failed-text); }
.review-data { width: 100%; margin-top: var(--space-xs); }
.review-error { width: 100%; margin-top: var(--space-xs); font-size: 0.8em; color: var(--error); }

/* Files */
.file-item {
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
}

.file-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.82em;
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}
.file-link:hover { text-decoration: underline; }
.file-meta { display: block; font-size: 0.7em; color: var(--text-muted); margin-top: 2px; }

/* Trace toggle */
.trace-member-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border-light);
}

.trace-member-block:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.trace-member-label {
  font-size: 0.75em;
  font-weight: 600;
  color: var(--accent);
}
.trace-toggle-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.78em;
  color: var(--text-secondary);
  cursor: pointer;
  margin-top: var(--space-sm);
  padding: 2px 0;
}
.trace-toggle-row:hover { color: var(--accent); }

.trace-count {
  color: var(--text-muted);
}

.trace-expand {
  margin-left: auto;
  color: var(--accent);
}

.trace-steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.trace-step {
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border-light);
}

.trace-step-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.step-index { font-size: 0.72em; font-weight: 600; color: var(--text-muted); }
.step-tools { display: flex; gap: var(--space-xs); }

.tool-tag {
  font-size: 0.68em;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--task-running-bg);
  color: var(--task-running-text);
  font-weight: 500;
}

.step-reasoning {
  font-size: 0.8em;
  color: var(--text-secondary);
  line-height: 1.4;
  margin: var(--space-xs) 0;
  white-space: pre-wrap;
}

.step-details { margin-top: var(--space-xs); }

.tool-call-block { margin-bottom: var(--space-xs); }

.tool-call-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  margin-bottom: 2px;
}

.tool-name { font-size: 0.72em; font-weight: 600; color: var(--accent); }

.tool-args {
  font-size: 0.72em;
  color: var(--text-secondary);
  font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
  background: var(--bg-tertiary);
  padding: 1px 4px;
  border-radius: 3px;
  word-break: break-all;
}

.tool-result { margin-top: 2px; }

.tool-result-content {
  font-size: 0.72em;
  line-height: 1.4;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
  max-height: 200px;
  overflow-y: auto;
}

/* Shared */
.resource-by {
  font-size: 0.72em;
  font-weight: 600;
  color: var(--accent);
  display: block;
  margin-bottom: var(--space-xs);
}

/* Actions */
.detail-actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  border-top: 1px solid var(--border-light);
  padding-top: var(--space-md);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.82em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.action-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-start:hover:not(:disabled) { background: var(--task-running-bg); border-color: var(--task-running-border); color: var(--task-running-text); }
.action-complete:hover:not(:disabled) { background: var(--task-completed-bg); border-color: var(--task-completed-border); color: var(--task-completed-text); }
.action-upload:hover:not(:disabled) { background: var(--bg-tertiary); }
.action-approve:hover:not(:disabled) { background: var(--task-completed-bg); border-color: var(--task-completed-border); color: var(--task-completed-text); }
.action-reject:hover:not(:disabled) { background: var(--task-failed-bg); border-color: var(--task-failed-border); color: var(--task-failed-text); }
</style>
