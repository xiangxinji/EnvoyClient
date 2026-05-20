<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { TaskMessage } from "../../types";
import { renderMarkdown } from "../../utils/markdown";
import { getResultText, formatFileSize, formatTimestamp, getTraceSteps, formatToolArgs, formatToolResult } from "../../utils/taskFormatters";
import { useTaskResources } from "../../composables/useTaskResources";
import { useTaskPermissions } from "../../composables/useTaskPermissions";
import { useTaskActions } from "../../composables/useTaskActions";
import ConfirmDialog from "../ConfirmDialog";
import Toast from "../Toast";
import SvgIcon from "../SvgIcon";

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

const resources = computed(() => props.task.resources ?? []);
const { clientResults, fileResources, traceResources, leaderReviews, isAIExecuted, isAIReview } = useTaskResources(resources);

const subscribe = computed(() => props.task.subscribe);
const from = computed(() => props.task.from);
const status = computed(() => props.task.status);
const { isAssignedToMe, canStart, canComplete, canUpload, canReview } = useTaskPermissions(subscribe, from, props.myId, status);

const taskId = computed(() => props.task.taskId);
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

function getMemberStatusClass(entry: { hasResult: boolean }): string {
  if (entry.hasResult) return "completed";
  return (props.task.status === "completed" || props.task.status === "failed") ? props.task.status : "pending";
}

function getMemberStatusLabel(entry: { hasResult: boolean }): string {
  if (entry.hasResult) return statusLabels["completed"];
  return (props.task.status === "completed" || props.task.status === "failed") ? statusLabels[props.task.status] : t('task.status.pending');
}

const traceExpanded = ref(false);
</script>

<template>
  <div class="task-card" :class="task.status" @click="emit('selectTask', task)">
    <div class="task-header">
      <div class="task-title">
        <SvgIcon name="check-circle" :size="14" />
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
        <SvgIcon name="file-text" :size="13" />
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
        <SvgIcon name="check-circle" :size="13" />
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
        <SvgIcon name="file-plus" :size="13" />
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
            <SvgIcon name="spinner" :size="12" class="spin" />
            {{ $t('task.downloading') }}
          </template>
          <template v-else>
            <SvgIcon name="download" :size="12" />
            {{ (res.data as any).filename }}
          </template>
        </a>
        <span class="file-meta">{{ formatFileSize((res.data as any).size) }} · {{ formatTimestamp((res.data as any).uploadedAt) }}</span>
      </div>
    </div>

    <!-- Execution trace section -->
    <div v-if="traceResources.length > 0" class="task-section">
      <div class="section-label clickable" @click.stop="traceExpanded = !traceExpanded">
        <SvgIcon name="activity" :size="13" />
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
      <button v-if="canStart" class="action-btn action-start" :disabled="starting" @click="handleStart(() => emit('statusChanged'))">
        <SvgIcon name="play" :size="12" />
        {{ starting ? $t('task.starting') : $t('task.startExecution') }}
      </button>
      <button v-if="canUpload" class="action-btn action-upload" :disabled="uploading" @click="handleUpload(() => emit('statusChanged'))">
        <SvgIcon name="upload" :size="12" />
        {{ uploading ? $t('task.uploading') : $t('task.uploadFile') }}
      </button>
      <button v-if="canComplete" class="action-btn action-complete" :disabled="completing" @click="requestComplete(() => emit('statusChanged'))">
        <SvgIcon name="check" :size="12" />
        {{ completing ? $t('task.submitting') : $t('task.markComplete') }}
      </button>
    </div>

    <!-- Leader review buttons -->
    <div v-if="canReview" class="task-actions" @click.stop>
      <button class="action-btn action-approve" :disabled="reviewing" @click="requestApprove(() => emit('statusChanged'))">
        <SvgIcon name="check" :size="12" />
        {{ reviewing ? $t('task.processing') : $t('task.approve') }}
      </button>
      <button class="action-btn action-reject" :disabled="reviewing" @click="requestReject(() => emit('statusChanged'))">
        <SvgIcon name="close" :size="12" />
        {{ $t('task.reject') }}
      </button>
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

    <div class="task-meta">
      <span>{{ $t('task.from', { from: task.from }) }}</span>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
