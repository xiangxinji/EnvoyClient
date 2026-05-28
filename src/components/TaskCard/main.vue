<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { TaskMessage } from "../../types";
import { getStatusLabels } from "../../utils/taskFormatters";
import { useTaskResources } from "../../composables/useTaskResources";
import { useTaskPermissions } from "../../composables/useTaskPermissions";
import { useTaskActions } from "../../composables/useTaskActions";
import TaskActionButtons from "../TaskActionButtons";
import ConfirmDialog from "../ConfirmDialog";
import Toast from "../Toast";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

const props = withDefaults(defineProps<{
  task: TaskMessage;
  teamName?: string;
  myId?: string;
  showActions?: boolean;
}>(), {
  showActions: false,
});

const emit = defineEmits<{
  statusChanged: [];
  taskResolved: [];
  selectTask: [task: TaskMessage];
}>();

const statusLabels = getStatusLabels(t);

const resources = computed(() => props.task.resources ?? []);
const { clientResults } = useTaskResources(resources);

const subscribe = computed(() => props.task.subscribe);
const from = computed(() => props.task.from);
const status = computed(() => props.task.status);
const { isAssignedToMe, canStart, canComplete, canUpload, canReview } = useTaskPermissions(subscribe, from, props.myId, status);

const taskId = computed(() => props.task.taskId);
const {
  memberEntries,
  starting, completing, uploading, reviewing,
  toastVisible, toastMessage, toastType, hideToast,
  confirmVisible, confirmTitle, confirmMessage, confirmDanger,
  handleConfirm, handleCancel,
  handleStart, requestComplete,
  requestApprove, requestReject,
  handleUpload,
} = useTaskActions(taskId, subscribe, resources, props.myId, props.teamName, clientResults);

const memberCount = computed(() => memberEntries.value.length);

const statusFlash = ref("");
watch(status, (newStatus, oldStatus) => {
  if (oldStatus && newStatus !== oldStatus) {
    statusFlash.value = newStatus;
    setTimeout(() => { statusFlash.value = ""; }, 500);
  }
});
</script>

<template>
  <div
    class="task-card"
    :class="[task.status, { [`status-flash-${statusFlash}`]: statusFlash }]"
    @click="emit('selectTask', task)"
  >
    <div class="task-body">
      <div class="task-content-row">
        <p class="task-content">{{ task.content }}</p>
        <span class="status-pill" :class="task.status">{{ statusLabels[task.status] }}</span>
      </div>

      <div class="task-footer">
        <span class="task-meta">
          <SvgIcon name="user" :size="12" />
          {{ $t('task.from', { from: task.from }) }}
          <template v-if="memberCount > 0">
            <span class="meta-sep">·</span>
            <SvgIcon name="users" :size="12" />
            {{ memberCount }} {{ t('task.collaborators') }}
          </template>
        </span>

        <TaskActionButtons
          v-if="showActions"
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
          @complete="requestComplete(() => { emit('statusChanged'); emit('taskResolved'); })"
          @approve="requestApprove(() => { emit('statusChanged'); emit('taskResolved'); })"
          @reject="requestReject(() => { emit('statusChanged'); emit('taskResolved'); })"
        />
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
