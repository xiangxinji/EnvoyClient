<script setup lang="ts">
import { computed, ref } from "vue";
import { marked, type Tokens } from "marked";
import DOMPurify from "dompurify";
import type { TaskMessage, TaskResource, AgentStep } from "../types";
import { apiUrl, managerPost } from "../api";

marked.setOptions({ gfm: true, breaks: true });

const linkRenderer = {
  link({ href, title, text }: Tokens.Link) {
    const titleAttr = title ? ` title="${title}"` : "";
    return `<a target="_blank" rel="noopener noreferrer" href="${href}"${titleAttr}>${text}</a>`;
  },
};
marked.use({ renderer: linkRenderer });

const props = defineProps<{
  task: TaskMessage;
  teamName?: string;
  myId?: string;
}>();

const emit = defineEmits<{
  statusChanged: [];
}>();

const statusLabels: Record<TaskMessage["status"], string> = {
  pending: "等待中",
  running: "执行中",
  reviewing: "审查中",
  completed: "已完成",
  failed: "失败",
};

// ─── Group resources by type ───

const clientResults = computed<TaskResource[]>(() =>
  props.task.resources?.filter((r) => r.type === "client-result") ?? []
);

const fileResources = computed<TaskResource[]>(() =>
  props.task.resources?.filter((r) => r.type === "file-resource") ?? []
);

const traceResources = computed<TaskResource[]>(() =>
  props.task.resources?.filter((r) => r.type === "execution-trace") ?? []
);

// ─── Members ───

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
    for (const id of props.task.subscribe ?? []) {
      if (!resultMemberIds.has(id)) {
        entries.push({ id, hasResult: false });
      }
    }
    return entries;
  }

  if (props.task.subscribe?.length) {
    return props.task.subscribe.map((id) => ({ id, hasResult: false }));
  }

  return [];
});

// ─── Task operations ───

const isAssignedToMe = computed(() => {
  return props.myId && (props.task.subscribe ?? []).includes(props.myId);
});

const isCreatedByMe = computed(() => {
  return props.myId && props.task.from === props.myId;
});

const canStart = computed(() => isAssignedToMe.value && props.task.status === "pending");
const canComplete = computed(() => isAssignedToMe.value && props.task.status === "running");
const canUpload = computed(() => isAssignedToMe.value && (props.task.status === "running" || props.task.status === "pending"));
const canReview = computed(() => isCreatedByMe.value && props.task.status === "reviewing");
function getMemberStatusClass(entry: MemberEntry): string {
  if (entry.hasResult) return "completed";
  return (props.task.status === "completed" || props.task.status === "failed") ? props.task.status : "pending";
}

function getMemberStatusLabel(entry: MemberEntry): string {
  if (entry.hasResult) return statusLabels["completed"];
  return (props.task.status === "completed" || props.task.status === "failed") ? statusLabels[props.task.status] : "等待中";
}

const starting = ref(false);
const completing = ref(false);
const uploading = ref(false);
const reviewing = ref(false);

async function handleStart() {
  if (starting.value) return;
  starting.value = true;
  try {
    const res = await managerPost(`/api/tasks/${props.task.taskId}/start`, { from: props.myId }, { team: props.teamName ?? "" });
    if (res.ok) emit("statusChanged");
    else alert("操作失败");
  } catch {
    alert("操作失败");
  }
  starting.value = false;
}

async function handleComplete() {
  if (!confirm("确定要标记此任务为完成吗？")) return;
  if (completing.value) return;
  completing.value = true;
  try {
    const res = await managerPost(`/api/tasks/${props.task.taskId}/complete`, { from: props.myId, data: { note: "手动标记完成" } }, { team: props.teamName ?? "" });
    if (res.ok) emit("statusChanged");
    else alert("操作失败");
  } catch {
    alert("操作失败");
  }
  completing.value = false;
}

async function handleApprove() {
  if (reviewing.value) return;
  reviewing.value = true;
  try {
    const res = await managerPost(`/api/tasks/${props.task.taskId}/result`, {
      from: props.myId,
      success: true,
      data: { review: "通过" },
    }, { team: props.teamName ?? "" });
    if (res.ok) emit("statusChanged");
    else alert("操作失败");
  } catch {
    alert("操作失败");
  }
  reviewing.value = false;
}

async function handleReject() {
  const reason = prompt("请输入驳回原因：");
  if (reason === null) return;
  if (reviewing.value) return;
  reviewing.value = true;
  try {
    const res = await managerPost(`/api/tasks/${props.task.taskId}/result`, {
      from: props.myId,
      success: false,
      error: reason || "未通过审查",
    }, { team: props.teamName ?? "" });
    if (res.ok) emit("statusChanged");
    else alert("操作失败");
  } catch {
    alert("操作失败");
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
      const res = await fetch(apiUrl(`/api/tasks/${props.task.taskId}/resources`), {
        method: "POST",
        headers: { team: props.teamName ?? "" },
        body: formData,
      });
      if (!res.ok) throw new Error("上传失败");
      emit("statusChanged");
    } catch {
      alert("文件上传失败");
    }
    uploading.value = false;
  };
  input.click();
}

// ─── Summary Markdown rendering ───

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

// ─── File helpers ───

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileDownloadUrl(filename: string): string {
  return apiUrl(`/api/tasks/${props.task.taskId}/resources/${encodeURIComponent(filename)}`);
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
    alert("文件下载失败，可能已被删除");
  }
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

// ─── Trace ───

const traceExpanded = ref(false);

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
    if ("done" in obj) return String((result as any).result ?? "done");
  }
  return JSON.stringify(result);
}
</script>

<template>
  <div class="task-card" :class="task.status">
    <div class="task-header">
      <div class="task-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span>任务</span>
      </div>
      <span class="status-badge" :class="task.status">{{ statusLabels[task.status] }}</span>
    </div>
    <div class="task-content">{{ task.content }}</div>

    <!-- Member list -->
    <div v-if="memberEntries.length > 0" class="task-members">
      <div v-for="entry in memberEntries" :key="entry.id" class="task-member-row">
        <span class="task-member-id">{{ entry.id }}</span>
        <span class="task-member-status" :class="getMemberStatusClass(entry)">
          {{ getMemberStatusLabel(entry) }}
        </span>
      </div>
    </div>

    <!-- Summary section -->
    <div v-if="clientResults.length > 0" class="task-section">
      <div class="section-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        执行结果
      </div>
      <div v-for="(res, i) in clientResults" :key="`summary-${i}`" class="summary-item">
        <span class="resource-by">{{ res.by }}</span>
        <div
          class="markdown-content"
          v-html="renderMarkdown(getResultText(res.data))"
        />
      </div>
    </div>

    <!-- Resources section -->
    <div v-if="fileResources.length > 0" class="task-section">
      <div class="section-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
        上传文件
      </div>
      <div v-for="(res, i) in fileResources" :key="`file-${i}`" class="file-item">
        <span class="resource-by">{{ res.by }}</span>
        <a
          class="file-link"
          href="javascript:void(0)"
          @click="downloadFile((res.data as any).filename)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {{ (res.data as any).filename }}
        </a>
        <span class="file-meta">{{ formatFileSize((res.data as any).size) }} · {{ formatTimestamp((res.data as any).uploadedAt) }}</span>
      </div>
    </div>

    <!-- Execution trace section -->
    <div v-if="traceResources.length > 0" class="task-section">
      <div class="section-label clickable" @click="traceExpanded = !traceExpanded">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        执行过程
        <span class="trace-toggle">{{ traceExpanded ? "收起" : "展开" }}</span>
        <span class="trace-count">{{ getTraceSteps(traceResources[0]).length }} 步</span>
      </div>
      <div v-if="traceExpanded" class="trace-timeline">
        <div v-for="step in getTraceSteps(traceResources[0])" :key="step.index" class="trace-step">
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
      </div>
    </div>

    <!-- Operation buttons -->
    <div v-if="isAssignedToMe && (canStart || canUpload || canComplete)" class="task-actions">
      <button v-if="canStart" class="action-btn action-start" :disabled="starting" @click="handleStart">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        {{ starting ? '执行中...' : '开始执行' }}
      </button>
      <button v-if="canUpload" class="action-btn action-upload" :disabled="uploading" @click="handleUpload">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {{ uploading ? '上传中...' : '上传文件' }}
      </button>
      <button v-if="canComplete" class="action-btn action-complete" :disabled="completing" @click="handleComplete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        {{ completing ? '提交中...' : '标记完成' }}
      </button>
    </div>

    <!-- Leader review buttons -->
    <div v-if="canReview" class="task-actions">
      <button class="action-btn action-approve" :disabled="reviewing" @click="handleApprove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        {{ reviewing ? '处理中...' : '通过' }}
      </button>
      <button class="action-btn action-reject" :disabled="reviewing" @click="handleReject">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        驳回
      </button>
    </div>

    <div class="task-meta">
      <span>来自 {{ task.from }}</span>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  max-width: 80%;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  border-left: 3px solid var(--border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  color: var(--text-primary);
  align-self: flex-start;
  box-shadow: var(--shadow-sm);
}

.task-card.running { border-left-color: var(--task-running-border); }
.task-card.reviewing { border-left-color: var(--task-reviewing-border); }
.task-card.completed { border-left-color: var(--task-completed-border); }
.task-card.failed { border-left-color: var(--task-failed-border); }

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.task-title {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: 600;
  font-size: 0.8em;
  color: var(--text-secondary);
}

.status-badge {
  font-size: 0.7em;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.status-badge.pending { background: var(--task-pending-bg); color: var(--task-pending-text); }
.status-badge.running { background: var(--task-running-bg); color: var(--task-running-text); }
.status-badge.reviewing { background: var(--task-reviewing-bg); color: var(--task-reviewing-text); }
.status-badge.completed { background: var(--task-completed-bg); color: var(--task-completed-text); }
.status-badge.failed { background: var(--task-failed-bg); color: var(--task-failed-text); }

.task-content {
  font-size: 0.9em;
  line-height: 1.4;
}

/* Member list */
.task-members {
  margin-top: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.task-member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
}

.task-member-id { font-size: 0.8em; font-weight: 500; color: var(--text-primary); }

.task-member-status {
  font-size: 0.7em;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.task-member-status.pending { background: var(--task-pending-bg); color: var(--task-pending-text); }
.task-member-status.running { background: var(--task-running-bg); color: var(--task-running-text); }
.task-member-status.reviewing { background: var(--task-reviewing-bg); color: var(--task-reviewing-text); }
.task-member-status.completed { background: var(--task-completed-bg); color: var(--task-completed-text); }
.task-member-status.failed { background: var(--task-failed-bg); color: var(--task-failed-text); }

/* Sections */
.task-section {
  margin-top: var(--space-md);
  border-top: 1px solid var(--border-light);
  padding-top: var(--space-sm);
}

.section-label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.75em;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
}

.section-label.clickable { cursor: pointer; user-select: none; }
.section-label.clickable:hover { color: var(--accent); }

.trace-toggle {
  margin-left: auto;
  font-weight: 400;
  color: var(--accent);
}

.trace-count {
  font-weight: 400;
  color: var(--text-muted);
  margin-left: var(--space-xs);
}

/* Summary */
.summary-item {
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  margin-bottom: var(--space-xs);
}

.markdown-content {
  font-size: 0.85em;
  line-height: 1.45;
  word-break: break-word;
}

.markdown-content :deep(p) { margin: 0 0 0.4em; }
.markdown-content :deep(p:last-child) { margin-bottom: 0; }
.markdown-content :deep(strong) { font-weight: 600; }
.markdown-content :deep(em) { font-style: italic; }
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
.markdown-content :deep(ul), .markdown-content :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.5em;
}
.markdown-content :deep(li) { margin: 0.15em 0; }
.markdown-content :deep(blockquote) {
  margin: 0.5em 0;
  padding: 4px 12px;
  border-left: 3px solid var(--md-blockquote-border);
  color: var(--md-blockquote-text);
}

/* File resources */
.file-item {
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  margin-bottom: var(--space-xs);
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

.file-meta {
  display: block;
  font-size: 0.7em;
  color: var(--text-muted);
  margin-top: 2px;
}

/* Execution trace */
.trace-timeline {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.trace-step {
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
}

.trace-step-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.step-index {
  font-size: 0.72em;
  font-weight: 600;
  color: var(--text-muted);
}

.step-tools {
  display: flex;
  gap: var(--space-xs);
}

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

.step-details {
  margin-top: var(--space-xs);
}

.tool-call-block {
  margin-bottom: var(--space-xs);
}

.tool-call-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  margin-bottom: 2px;
}

.tool-name {
  font-size: 0.72em;
  font-weight: 600;
  color: var(--accent);
}

.tool-args {
  font-size: 0.72em;
  color: var(--text-secondary);
  font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
  background: var(--bg-tertiary);
  padding: 1px 4px;
  border-radius: 3px;
  word-break: break-all;
}

.tool-result {
  margin-top: 2px;
}

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

/* Task actions */
.task-actions {
  margin-top: var(--space-md);
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.78em;
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

.action-start:hover:not(:disabled) {
  background: var(--task-running-bg);
  border-color: var(--task-running-border);
  color: var(--task-running-text);
}

.action-complete:hover:not(:disabled) {
  background: var(--task-completed-bg);
  border-color: var(--task-completed-border);
  color: var(--task-completed-text);
}

.action-upload:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.action-approve:hover:not(:disabled) {
  background: var(--task-completed-bg);
  border-color: var(--task-completed-border);
  color: var(--task-completed-text);
}

.action-reject:hover:not(:disabled) {
  background: var(--task-failed-bg);
  border-color: var(--task-failed-border);
  color: var(--task-failed-text);
}

/* Shared */
.resource-by {
  font-size: 0.72em;
  font-weight: 600;
  color: var(--accent);
  display: block;
  margin-bottom: var(--space-xs);
}

.task-meta {
  margin-top: var(--space-sm);
  font-size: 0.72em;
  color: var(--text-muted);
}
</style>
