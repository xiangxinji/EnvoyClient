<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import type { TaskMessage } from "../../types";
import type { Task } from "../../../envoy/packages/core/task.js";
import { getResultText, formatFileSize, formatTimestamp, formatTime, getTraceSteps, formatToolArgs, formatToolResult, getStatusLabels, apiTaskToTaskMessage, type ApiTask } from "../../utils/taskFormatters";
import { useTaskResources } from "../../composables/useTaskResources";
import { useTaskPermissions } from "../../composables/useTaskPermissions";
import { useTaskActions } from "../../composables/useTaskActions";
import { managerFetch } from "../../api";
import { renderMarkdown } from "../../utils/markdown";
import { inject } from "vue";
import { TeamClientKey } from "../../composables/teamClientContext";
import ConfirmDialog from "../ConfirmDialog";
import Toast from "../Toast";
import BackButton from "../BackButton";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

const ctx = inject(TeamClientKey)!;

const props = defineProps<{
  task: TaskMessage;
  teamName?: string;
  myId?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const liveTask = ref<TaskMessage>({ ...props.task });

async function fetchTask() {
  try {
    const res = await managerFetch(`/api/teams/${encodeURIComponent(ctx.teamName)}/tasks/${liveTask.value.taskId}`);
    if (!res.ok) return;
    const t = await res.json() as ApiTask;
    liveTask.value = apiTaskToTaskMessage(t);
  } catch { /* ignore */ }
}

function onTaskUpdate(task: Task) {
  if (task.id === liveTask.value.taskId) {
    liveTask.value = apiTaskToTaskMessage(task as unknown as ApiTask);
  }
}

onMounted(async () => {
  await fetchTask();
  ctx.client?.on("task", onTaskUpdate);
});

onUnmounted(() => {
  ctx.client?.off("task", onTaskUpdate);
});

const statusLabels = getStatusLabels(t);

const modeLabels: Record<string, string> = {
  serial: t('task.mode.serial'),
  parallel: t('task.mode.parallel'),
};

const resources = computed(() => liveTask.value.resources ?? []);
const { clientResults, fileResources, traceResources, leaderReviews, isAIExecuted } = useTaskResources(resources);

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
    label: t('task.createTask'),
    by: liveTask.value.from,
    icon: "create",
  });

  for (const r of clientResults.value) {
    events.push({ time: r.timestamp, label: t('task.executionDone'), by: r.by, icon: "result" });
  }

  for (const r of leaderReviews.value) {
    const success = r.data?.success;
    events.push({ time: r.timestamp, label: success ? t('task.reviewApprovedLabel') : t('task.reviewRejectedLabel'), by: r.by, icon: "review", success });
  }

  for (const r of fileResources.value) {
    events.push({ time: r.timestamp, label: t('task.uploadFile'), by: r.by, icon: "file" });
  }

  events.sort((a, b) => {
    if (a.time !== undefined && b.time !== undefined) return a.time - b.time;
    if (a.time !== undefined) return -1;
    if (b.time !== undefined) return 1;
    return 0;
  });

  return events;
});

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

const subscribe = computed(() => liveTask.value.subscribe);
const from = computed(() => liveTask.value.from);
const status = computed(() => liveTask.value.status);
const { isAssignedToMe, canStart, canComplete, canUpload, canReview } = useTaskPermissions(subscribe, from, props.myId, status);

const taskId = computed(() => liveTask.value.taskId);
const {
  memberEntries,
  starting, completing, uploading, reviewing,
  downloading,
  toastVisible, toastMessage, toastType, hideToast,
  confirmVisible, confirmTitle, confirmMessage, confirmDanger,
  handleConfirm, handleCancel,
  handleStart, requestComplete,
  requestApprove, requestReject,
  handleUpload, downloadFile,
} = useTaskActions(taskId, subscribe, resources, props.myId, props.teamName);

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
      <span class="detail-title">{{ $t('task.detail') }}</span>
      <BackButton @click="emit('close')" />
    </div>

    <div class="detail-body">
      <div class="detail-meta-row">
        <span class="status-badge" :class="liveTask.status">{{ statusLabels[liveTask.status] }}</span>
        <span class="mode-badge">{{ modeLabels['serial'] ?? $t('task.mode.serial') }}</span>
      </div>

      <div class="detail-content">{{ liveTask.content }}</div>

      <div class="detail-info-grid">
        <div class="info-item">
          <span class="info-label">{{ $t('task.creator') }}</span>
          <span class="info-value">{{ liveTask.from }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ $t('task.createdAt') }}</span>
          <span class="info-value">{{ formatTimestamp(liveTask.timestamp) }}</span>
        </div>
        <div v-if="duration" class="info-item">
          <span class="info-label">{{ $t('task.duration') }}</span>
          <span class="info-value">{{ duration }}</span>
        </div>
      </div>

      <!-- Timeline -->
      <div class="detail-section">
        <div class="section-title">{{ $t('task.timeline') }}</div>
        <div class="timeline">
          <div v-for="(evt, i) in timelineEvents" :key="i" class="timeline-item">
            <div class="timeline-dot" :class="evt.icon">
              <SvgIcon v-if="evt.icon === 'create'" name="circle" :size="10" />
              <SvgIcon v-else-if="evt.icon === 'result'" name="check" :size="10" />
              <SvgIcon v-else-if="evt.icon === 'review'" name="check-circle" :size="10" />
              <SvgIcon v-else name="file" :size="10" />
            </div>
            <div class="timeline-content">
              <span class="timeline-label">{{ evt.label }}</span>
              <span class="timeline-by">{{ evt.by }}</span>
              <span v-if="evt.time !== undefined" class="timeline-time">{{ formatTime(evt.time) }}</span>
              <span v-if="evt.success === false" class="timeline-reject">{{ $t('task.rejected') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Member results -->
      <div v-if="memberEntries.length > 0" class="detail-section">
        <div class="section-title">{{ $t('task.memberExecution') }}</div>
        <div class="member-results">
          <div v-for="entry in memberEntries" :key="entry.id" class="member-block">
            <div class="member-block-header">
              <span class="member-id">{{ entry.id }}</span>
              <span v-if="entry.hasResult" class="member-status completed">{{ $t('task.status.completed') }}</span>
              <span v-else class="member-status pending">{{ $t('task.pendingExecute') }}</span>
            </div>
            <template v-if="entry.hasResult">
              <div v-for="res in clientResults.filter(r => r.by === entry.id)" :key="res.by" class="result-block">
                <span v-if="isAIExecuted(res)" class="source-badge ai">AI</span>
                <span v-else class="source-badge manual">{{ $t('task.manual') }}</span>
                <div class="markdown-content" v-html="renderMarkdown(getResultText(res.data))" />
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Execution traces -->
      <div v-if="traceResources.length > 0" class="detail-section">
        <div class="section-title clickable" @click="toggleTrace('__all__')">
          <SvgIcon name="activity" :size="13" />
          {{ $t('task.executionTrace') }}
          <span class="trace-count">{{ $t('task.steps', { count: traceResources.map(r => getTraceSteps(r).length).reduce((a, b) => a + b, 0) }) }}</span>
          <span class="trace-expand">{{ isTraceExpanded('__all__') ? $t('task.collapse') : $t('task.expand') }}</span>
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
        <div class="section-title">{{ $t('task.reviewLog') }}</div>
        <div v-for="(review, i) in leaderReviews" :key="`review-${i}`" class="review-item" :class="review.data?.success ? 'approved' : 'rejected'">
          <span class="resource-by">{{ review.by }}</span>
          <span class="review-status" :class="review.data?.success ? 'approved' : 'rejected'">
            {{ review.data?.success ? $t('task.approved') : $t('task.rejected') }}
          </span>
          <div v-if="review.data?.data" class="review-data">
            <div class="markdown-content" v-html="renderMarkdown(getResultText(review.data.data))" />
          </div>
          <div v-if="review.data?.error" class="review-error">{{ review.data.error }}</div>
        </div>
      </div>

      <!-- File resources -->
      <div v-if="fileResources.length > 0" class="detail-section">
        <div class="section-title">{{ $t('task.resourceFiles') }}</div>
        <div v-for="(res, i) in fileResources" :key="`file-${i}`" class="file-item">
          <span class="resource-by">{{ res.by }}</span>
          <a class="file-link" :class="{ disabled: downloading === res.data.filename }" href="javascript:void(0)" @click="downloadFile(res.data.filename)">
            <template v-if="downloading === res.data.filename">
              <SvgIcon name="spinner" :size="12" class="spin" />
              {{ $t('task.downloading') }}
            </template>
            <template v-else>
              <SvgIcon name="download" :size="12" />
              {{ res.data.filename }}
            </template>
          </a>
          <span class="file-meta">{{ formatFileSize(res.data.size) }} · {{ formatTimestamp(res.data.uploadedAt) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="isAssignedToMe && (canStart || canUpload || canComplete)" class="detail-actions">
        <button v-if="canStart" class="action-btn action-start" :disabled="starting" @click="handleStart()">
          <SvgIcon name="play" :size="12" />
          {{ starting ? $t('task.starting') : $t('task.startExecution') }}
        </button>
        <button v-if="canUpload" class="action-btn action-upload" :disabled="uploading" @click="handleUpload()">
          <SvgIcon name="upload" :size="12" />
          {{ uploading ? $t('task.uploading') : $t('task.uploadFile') }}
        </button>
        <button v-if="canComplete" class="action-btn action-complete" :disabled="completing" @click="requestComplete()">
          <SvgIcon name="check" :size="12" />
          {{ completing ? $t('task.submitting') : $t('task.markComplete') }}
        </button>
      </div>

      <div v-if="canReview" class="detail-actions">
        <button class="action-btn action-approve" :disabled="reviewing" @click="requestApprove()">
          <SvgIcon name="check" :size="12" />
          {{ reviewing ? $t('task.processing') : $t('task.approve') }}
        </button>
        <button class="action-btn action-reject" :disabled="reviewing" @click="requestReject()">
          <SvgIcon name="close" :size="12" />
          {{ $t('task.reject') }}
        </button>
      </div>
    </div>

    <ConfirmDialog
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :danger="confirmDanger"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
    <Toast
      :visible="toastVisible"
      :message="toastMessage"
      :type="toastType"
      @done="hideToast"
    />
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
