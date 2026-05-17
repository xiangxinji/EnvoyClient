<script setup lang="ts">
import { ref, provide } from "vue";
import { useRouter } from "vue-router";
import MemberSidebar from "../components/MemberSidebar.vue";
import ChatPanel from "../components/ChatPanel.vue";
import TaskCenterView from "./TaskCenterView.vue";
import TaskDispatchPanel from "./TaskDispatchPanel.vue";
import SettingsPanel from "../components/SettingsPanel.vue";
import QuickSettingsPanel from "../components/QuickSettingsPanel.vue";
import TaskDetailPanel from "../components/TaskDetailPanel.vue";
import { TeamClientKey, getTeamClientInstance } from "../composables/teamClientContext";
import { useGlobalShortcuts } from "../composables/useGlobalShortcuts";
import type { TaskMessage } from "../types";

const router = useRouter();
const ctx = getTeamClientInstance();

if (!ctx) {
  router.replace("/");
}

const selectedPeer = ref("__tasks__");
const previousPeer = ref("__tasks__");

const selectedTask = ref<TaskMessage | null>(null);
// When opening detail from chat, remember which peer to return to
const detailReturnPeer = ref<string | null>(null);

function handleSelectPeer(peerId: string) {
  // Switching sidebar tab clears the detail view
  selectedTask.value = null;
  detailReturnPeer.value = null;
  if (selectedPeer.value !== "__settings__" && selectedPeer.value !== "__quick__") {
    previousPeer.value = selectedPeer.value;
  }
  selectedPeer.value = peerId;
}

function handleSettingsBack() {
  selectedPeer.value = previousPeer.value;
}

function handleSelectTask(task: TaskMessage) {
  // Remember where we came from (could be a chat peer or __tasks__)
  if (selectedPeer.value !== "__tasks__") {
    detailReturnPeer.value = selectedPeer.value;
  }
  selectedTask.value = task;
}

function handleCloseDetail() {
  if (detailReturnPeer.value) {
    // Return to the chat panel we came from
    selectedPeer.value = detailReturnPeer.value;
    detailReturnPeer.value = null;
  }
  selectedTask.value = null;
}

if (ctx) {
  provide(TeamClientKey, ctx);
  useGlobalShortcuts(ctx);
}
</script>

<template>
  <div v-if="ctx" class="chat-view">
    <MemberSidebar
      :selected-peer="selectedPeer"
      @select="handleSelectPeer"
    />
    <SettingsPanel v-if="selectedPeer === '__settings__'" @back="handleSettingsBack" />
    <QuickSettingsPanel v-else-if="selectedPeer === '__quick__'" @back="handleSettingsBack" />
    <TaskDispatchPanel v-else-if="selectedPeer === '__dispatch__'" />
    <template v-else-if="selectedPeer === '__tasks__'">
      <TaskCenterView v-show="!selectedTask" @select-task="handleSelectTask" />
      <TaskDetailPanel
        v-if="selectedTask"
        :task="selectedTask"
        :team-name="ctx.teamName"
        :my-id="ctx.myId"
        @close="handleCloseDetail"
      />
    </template>
    <template v-else>
      <ChatPanel v-if="!selectedTask" :peer-id="selectedPeer" @select-task="handleSelectTask" />
      <TaskDetailPanel
        v-if="selectedTask"
        :task="selectedTask"
        :team-name="ctx.teamName"
        :my-id="ctx.myId"
        @close="handleCloseDetail"
      />
    </template>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
