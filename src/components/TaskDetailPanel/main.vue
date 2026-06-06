<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { TaskMessage } from "../../types";
import { getResultText, formatTimestamp, formatTime, getTraceSteps, getStatusLabels } from "../../utils/taskFormatters";
import { useTaskResources } from "../../composables/useTaskResources";
import { useTaskPermissions } from "../../composables/useTaskPermissions";
import { useTaskActions } from "../../composables/useTaskActions";
import { useTaskLiveData } from "../../composables/useTaskLiveData";
import { useTaskTimeline } from "../../composables/useTaskTimeline";
import { renderMarkdown } from "../../utils/markdown";
import TaskActionButtons from "../TaskActionButtons";
import TaskFileList from "../TaskFileList";
import TaskReviewList from "../TaskReviewList";
import TaskTraceBlock from "../TaskTraceBlock";
import ConfirmDialog from "../ConfirmDialog";
import Toast from "../Toast";
import BackButton from "../BackButton";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

const props = defineProps<{
  task: TaskMessage;
  teamName?: string;
  myId?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { liveTask } = useTaskLiveData(props.task);

const statusLabels = getStatusLabels(t);

const modeLabels: Record<string, string> = {
  serial: t('task.mode.serial'),
  parallel: t('task.mode.parallel'),
};

const liveTaskRef = computed(() => liveTask.value);
const resources = computed(() => liveTask.value.resources ?? []);
const { clientResults, fileResources, traceResources, leaderReviews, isAIExecuted } = useTaskResources(resources);
const { timelineEvents, duration } = useTaskTimeline({ liveTask: liveTaskRef, clientResults, leaderReviews, fileResources });

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
} = useTaskActions(taskId, subscribe, resources, props.myId, props.teamName, clientResults);

const traceExpanded = ref(false);

function toggleTrace(_by: string) {
  traceExpanded.value = !traceExpanded.value;
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
        <span class="mode-badge">{{ modeLabels[liveTask.mode ?? 'serial'] ?? $t('task.mode.serial') }}</span>
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
      <TaskTraceBlock
        :traces="traceResources"
        :expanded="traceExpanded"
        :total-steps="traceResources.map(r => getTraceSteps(r).length).reduce((a, b) => a + b, 0)"
        @toggle="toggleTrace('__all__')"
      />

      <!-- Leader reviews -->
      <TaskReviewList :reviews="leaderReviews" />

      <!-- File resources -->
      <TaskFileList :files="fileResources" :downloading="downloading" @download="downloadFile" />

      <!-- Actions -->
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
        @start="handleStart()"
        @upload="handleUpload()"
        @complete="requestComplete()"
        @approve="requestApprove()"
        @reject="requestReject()"
      />
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
