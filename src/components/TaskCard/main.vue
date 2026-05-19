<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { TaskMessage } from "../../types";
import { apiUrl, managerPost } from "../../api";
import { downloadFileWithDialog } from "../../utils/notification";
import { renderMarkdown } from "../../utils/markdown";
import { getResultText, formatFileSize, formatTimestamp, getTaskFileUrl, getTraceSteps, formatToolArgs, formatToolResult } from "../../utils/taskFormatters";
import { useTaskResources } from "../../composables/useTaskResources";
import { useTaskPermissions } from "../../composables/useTaskPermissions";
import ConfirmDialog from "../ConfirmDialog";
import Toast from "../Toast";

const { t } = useI18n();

const props = defineProps<{
  task: TaskMessage;
  teamName?: string;
  myId?: string;
}>();

const emit = defineEmits<{
  statusChanged: [];
  selectTask: [task: TaskMessage];
}>();

const statusLabels: Record<TaskMessage["status"], string> = {
  pending: t('task.status.pending'),
  running: t('task.status.running'),
  reviewing: t('task.status.reviewing'),
  completed: t('task.status.completed'),
  failed: t('task.status.failed'),
};

// ─── Shared composables ───

const resources = computed(() => props.task.resources ?? []);
const { clientResults, fileResources, traceResources, leaderReviews, isAIExecuted, isAIReview } = useTaskResources(resources);

const subscribe = computed(() => props.task.subscribe);
const from = computed(() => props.task.from);
const status = computed(() => props.task.status);
const { isAssignedToMe, canStart, canComplete, canUpload, canReview } = useTaskPermissions(subscribe, from, props.myId, status);

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

function getMemberStatusClass(entry: MemberEntry): string {
  if (entry.hasResult) return "completed";
  return (props.task.status === "completed" || props.task.status === "failed") ? props.task.status : "pending";
}

function getMemberStatusLabel(entry: MemberEntry): string {
  if (entry.hasResult) return statusLabels["completed"];
  return (props.task.status === "completed" || props.task.status === "failed") ? statusLabels[props.task.status] : t('task.status.pending');
}

// ─── Task operation state ───

const starting = ref(false);
const completing = ref(false);
const uploading = ref(false);
const reviewing = ref(false);

// ─── ConfirmDialog state ───
const confirmVisible = ref(false);
const confirmTitle = ref("");
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

async function handleStart() {
  if (starting.value) return;
  starting.value = true;
  try {
    const res = await managerPost(`/api/tasks/${props.task.taskId}/start`, { from: props.myId }, { team: props.teamName ?? "" });
    if (res.ok) emit("statusChanged");
    else showToast(t('common.operationFailed'), "error");
  } catch {
    showToast(t('common.operationFailed'), "error");
  }
  starting.value = false;
}

function requestComplete() {
  showConfirm(t('task.confirmComplete'), t('task.confirmCompleteMsg'), doComplete);
}

async function doComplete() {
  if (completing.value) return;
  completing.value = true;
  try {
    const res = await managerPost(`/api/tasks/${props.task.taskId}/complete`, { from: props.myId, data: { note: t('task.manualComplete'), source: "manual" } }, { team: props.teamName ?? "" });
    if (res.ok) emit("statusChanged");
    else showToast(t('common.operationFailed'), "error");
  } catch {
    showToast(t('common.operationFailed'), "error");
  }
  completing.value = false;
}

function requestApprove() {
  showConfirm(t('task.confirmApprove'), t('task.confirmApproveMsg'), doApprove);
}

async function doApprove() {
  if (reviewing.value) return;
  reviewing.value = true;
  try {
    const res = await managerPost(`/api/tasks/${props.task.taskId}/result`, {
      from: props.myId,
      success: true,
      data: { review: t('task.approved'), source: "manual" },
    }, { team: props.teamName ?? "" });
    if (res.ok) {
      emit("statusChanged");
      showToast(t('task.reviewApproved'), "success");
    } else {
      showToast(t('common.operationFailed'), "error");
    }
  } catch {
    showToast(t('common.operationFailed'), "error");
  }
  reviewing.value = false;
}

function requestReject() {
  showConfirm(t('task.confirmReject'), t('task.confirmRejectMsg'), doReject, true);
}

async function doReject() {
  if (reviewing.value) return;
  reviewing.value = true;
  try {
    const res = await managerPost(`/api/tasks/${props.task.taskId}/result`, {
      from: props.myId,
      success: false,
      error: t('task.reviewFailed'),
    }, { team: props.teamName ?? "" });
    if (res.ok) {
      emit("statusChanged");
      showToast(t('task.taskRejected'), "info");
    } else {
      showToast(t('common.operationFailed'), "error");
    }
  } catch {
    showToast(t('common.operationFailed'), "error");
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
      if (!res.ok) throw new Error(t('common.uploadFailed'));
      emit("statusChanged");
    } catch {
      showToast(t('common.fileUploadFailed'), "error");
    }
    uploading.value = false;
  };
  input.click();
}

// ─── File helpers ───

function getFileDownloadUrl(filename: string): string {
  return getTaskFileUrl(props.task.taskId, filename);
}

const downloading = ref("");

async function downloadFile(filename: string) {
  if (downloading.value) return;
  downloading.value = filename;
  try {
    const url = getFileDownloadUrl(filename);
    await downloadFileWithDialog(url, filename, { team: props.teamName ?? "" });
  } catch {
    showToast(t('common.fileDownloadFailed'), "error");
  } finally {
    downloading.value = "";
  }
}

// ─── Trace ───

const traceExpanded = ref(false);
</script>

<template>
  <div class="task-card" :class="task.status" @click="emit('selectTask', task)">
    <div class="task-header">
      <div class="task-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span>{{ $t('task.task') }}</span>
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
        {{ $t('task.executionResult') }}
      </div>
      <div v-for="(res, i) in clientResults" :key="`summary-${i}`" class="summary-item">
        <span class="resource-by">{{ res.by }}</span>
        <span v-if="isAIExecuted(res)" class="source-badge ai">AI</span>
        <span v-else class="source-badge manual">{{ $t('task.manual') }}</span>
        <div
          class="markdown-content"
          v-html="renderMarkdown(getResultText(res.data))"
        />
      </div>
    </div>

    <!-- Leader review section -->
    <div v-if="leaderReviews.length > 0" class="task-section">
      <div class="section-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        {{ $t('task.reviewLog') }}
      </div>
      <div v-for="(review, i) in leaderReviews" :key="`review-${i}`" class="review-item" :class="(review.data as any)?.success ? 'approved' : 'rejected'">
        <span class="resource-by">{{ review.by }}</span>
        <span class="review-status" :class="(review.data as any)?.success ? 'approved' : 'rejected'">
          {{ (review.data as any)?.success ? $t('task.approved') : $t('task.rejected') }}
        </span>
        <span v-if="isAIReview(review)" class="source-badge ai">AI</span>
        <span v-else class="source-badge manual">{{ $t('task.manual') }}</span>
        <div v-if="(review.data as any)?.data" class="review-data">
          <div class="markdown-content" v-html="renderMarkdown(getResultText((review.data as any).data))" />
        </div>
        <div v-if="(review.data as any)?.error" class="review-error">{{ (review.data as any).error }}</div>
      </div>
    </div>

    <!-- Resources section -->
    <div v-if="fileResources.length > 0" class="task-section">
      <div class="section-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
        {{ $t('task.uploadFile') }}
      </div>
      <div v-for="(res, i) in fileResources" :key="`file-${i}`" class="file-item">
        <span class="resource-by">{{ res.by }}</span>
        <a
          class="file-link"
          :class="{ disabled: downloading === (res.data as any).filename }"
          href="javascript:void(0)"
          @click.stop="downloadFile((res.data as any).filename)"
        >
          <template v-if="downloading === (res.data as any).filename">
            <svg class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            {{ $t('task.downloading') }}
          </template>
          <template v-else>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {{ (res.data as any).filename }}
          </template>
        </a>
        <span class="file-meta">{{ formatFileSize((res.data as any).size) }} · {{ formatTimestamp((res.data as any).uploadedAt) }}</span>
      </div>
    </div>

    <!-- Execution trace section -->
    <div v-if="traceResources.length > 0" class="task-section">
      <div class="section-label clickable" @click.stop="traceExpanded = !traceExpanded">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        {{ $t('task.executionTrace') }}
        <span class="trace-toggle">{{ traceExpanded ? $t('task.collapse') : $t('task.expand') }}</span>
        <span class="trace-count">{{ $t('task.steps', { count: getTraceSteps(traceResources[0]).length }) }}</span>
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
    <div v-if="isAssignedToMe && (canStart || canUpload || canComplete)" class="task-actions" @click.stop>
      <button v-if="canStart" class="action-btn action-start" :disabled="starting" @click="handleStart">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        {{ starting ? $t('task.starting') : $t('task.startExecution') }}
      </button>
      <button v-if="canUpload" class="action-btn action-upload" :disabled="uploading" @click="handleUpload">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {{ uploading ? $t('task.uploading') : $t('task.uploadFile') }}
      </button>
      <button v-if="canComplete" class="action-btn action-complete" :disabled="completing" @click="requestComplete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        {{ completing ? $t('task.submitting') : $t('task.markComplete') }}
      </button>
    </div>

    <!-- Leader review buttons -->
    <div v-if="canReview" class="task-actions" @click.stop>
      <button class="action-btn action-approve" :disabled="reviewing" @click="requestApprove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        {{ reviewing ? $t('task.processing') : $t('task.approve') }}
      </button>
      <button class="action-btn action-reject" :disabled="reviewing" @click="requestReject">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        {{ $t('task.reject') }}
      </button>
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

    <div class="task-meta">
      <span>{{ $t('task.from', { from: task.from }) }}</span>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
