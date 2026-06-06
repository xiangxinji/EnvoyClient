<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useTaskCenterData } from "../../composables/useTaskCenterData";
import { useTaskCenterExecution } from "../../composables/useTaskCenterExecution";
import TaskCard from "../../components/TaskCard";
import SvgIcon from "../../components/SvgIcon";
import type { TaskMessage } from "../../types";

const { t } = useI18n();

const emit = defineEmits<{
  selectTask: [task: TaskMessage];
}>();

const {
  currentTaskMsg, reviewTaskMsg, queuedTaskMsgs,
  allTasks, statusGroups,
  teamName, myId, role,
  currentClientTask,
  isReviewing, resolveCurrentTask, resolveCurrentReview, setAutoExecutor,
} = useTaskCenterData();

// Task center execution composable (Member only)
const taskExec = role === "member"
  ? useTaskCenterExecution({ myId, teamName }, currentClientTask, resolveCurrentTask, setAutoExecutor)
  : null;
</script>

<template>
  <div class="task-center">
    <div class="task-center-header">
      <span class="header-name">{{ $t('task.taskCenter') }}</span>
    </div>

    <div v-if="allTasks.length === 0 && !currentTaskMsg && queuedTaskMsgs.length === 0" class="empty-state">
      <SvgIcon name="check-circle" :size="48" />
      <p>{{ $t('task.noTasks') }}</p>
    </div>

    <div v-else class="task-groups">
      <!-- Current task section (Member only) -->
      <div v-if="role === 'member' && currentTaskMsg" class="task-group">
        <div class="group-header current-task-header">
          {{ t('task.currentTask', '当前任务') }}
          <span v-if="taskExec?.isRunning?.value" class="execution-badge">{{ t('task.executing', '执行中...') }}</span>
        </div>
        <TaskCard
          :task="currentTaskMsg"
          :team-name="teamName"
          :my-id="myId"
          :show-actions="true"
          @select-task="emit('selectTask', $event)"
          @task-resolved="resolveCurrentTask({ success: true, source: 'manual' })"
        />
        <div v-if="taskExec" class="manual-execute">
          <button v-if="taskExec.isRunning?.value" class="abort-btn" @click="resolveCurrentTask({ success: false, source: 'aborted', error: 'User aborted' })">
            {{ t('task.abort', '中止任务') }}
          </button>
          <button v-else class="execute-btn" @click="taskExec.executeCurrentTask()">
            {{ t('task.execute', '执行任务') }}
          </button>
        </div>
      </div>

      <!-- Queued tasks section (Member only) -->
      <div v-if="role === 'member' && queuedTaskMsgs.length > 0" class="task-group">
        <div class="group-header">{{ t('task.queued', '等待中') }} ({{ queuedTaskMsgs.length }})</div>
        <TransitionGroup name="task-list" tag="div" class="group-tasks">
          <TaskCard
            v-for="task in queuedTaskMsgs"
            :key="task.taskId"
            :task="task"
            :team-name="teamName"
            :my-id="myId"
            @select-task="emit('selectTask', $event)"
          />
        </TransitionGroup>
      </div>

      <!-- Reviewing task section (Leader only) -->
      <div v-if="role === 'leader' && reviewTaskMsg" class="task-group">
        <div class="group-header current-task-header">
          {{ t('task.reviewing', '审核中') }}
          <span v-if="isReviewing" class="execution-badge">{{ t('task.aiReviewing', 'AI 审核中...') }}</span>
        </div>
        <TaskCard
          :task="reviewTaskMsg"
          :team-name="teamName"
          :my-id="myId"
          @select-task="emit('selectTask', $event)"
        />
        <div v-if="!isReviewing" class="manual-review">
          <button class="approve-btn" @click="resolveCurrentReview({ success: true, source: 'manual', data: {} })">
            {{ t('task.approve', '通过') }}
          </button>
          <button class="reject-btn" @click="resolveCurrentReview({ success: false, source: 'manual', error: 'Leader rejected' })">
            {{ t('task.reject', '驳回') }}
          </button>
        </div>
      </div>

      <!-- Regular status groups -->
      <div v-for="group in statusGroups" :key="group.key" v-show="group.tasks.length > 0" class="task-group">
        <div v-if="group.tasks.length > 0" class="group-header">
          {{ group.label }} ({{ group.tasks.length }})
        </div>
        <TransitionGroup name="task-list" tag="div" class="group-tasks">
          <TaskCard
            v-for="task in group.tasks"
            :key="task.taskId"
            :task="task"
            :team-name="teamName"
            :my-id="myId"
            @select-task="emit('selectTask', $event)"
          />
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
