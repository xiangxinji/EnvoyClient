<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { TaskMessage } from "../../types";
import { renderMarkdown } from "../../utils/markdown";
import { getResultText, getTraceSteps, getStatusLabels } from "../../utils/taskFormatters";
import { useTaskResources } from "../../composables/useTaskResources";
import { useTaskPermissions } from "../../composables/useTaskPermissions";
import { useTaskActions } from "../../composables/useTaskActions";
import TaskActionButtons from "../TaskActionButtons";
import TaskFileList from "../TaskFileList";
import TaskReviewList from "../TaskReviewList";
import TaskTraceBlock from "../TaskTraceBlock";
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

const statusLabels = getStatusLabels(t);

const resources = computed(() => props.task.resources ?? []);
const { clientResults, fileResources, traceResources, leaderReviews, isAIExecuted } = useTaskResources(resources);

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
} = useTaskActions(taskId, subscribe, resources, props.myId, props.teamName, clientResults);

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
    <TaskReviewList :reviews="leaderReviews" />

    <!-- Resources section -->
    <TaskFileList :files="fileResources" :downloading="downloading" @download="downloadFile" />

    <!-- Execution trace section -->
    <TaskTraceBlock :traces="traceResources.length > 0 ? [traceResources[0]] : []" :expanded="traceExpanded" :total-steps="traceResources.length > 0 ? getTraceSteps(traceResources[0]).length : 0" @toggle="traceExpanded = !traceExpanded" />

    <!-- Operation buttons -->
    <TaskActionButtons
      :is-assigned-to-me="isAssignedToMe"
      :can-start="canStart"
      :can-upload="canUpload"
      :can-complete="canComplete"
      :can-review="canReview"
      :starting="starting"
      :uploading="uploading"
      :completing="completing"
      :reviewing="reviewing"
      @start="handleStart(() => emit('statusChanged'))"
      @upload="handleUpload(() => emit('statusChanged'))"
      @complete="requestComplete(() => emit('statusChanged'))"
      @approve="requestApprove(() => emit('statusChanged'))"
      @reject="requestReject(() => emit('statusChanged'))"
    />

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
