<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import MemberSidebar from "../../components/MemberSidebar";
import ChatPanel from "../../components/ChatPanel";
import TaskCenterView from "../TaskCenterView";
import TaskDispatchPanel from "../TaskDispatchPanel";
import SettingsProfile from "../../components/SettingsProfile";
import SettingsTask from "../../components/SettingsTask";
import SettingsAI from "../../components/SettingsAI";
import SettingsGeneral from "../../components/SettingsGeneral";
import QuickSettingsPanel from "../../components/QuickSettingsPanel";
import TaskDetailPanel from "../../components/TaskDetailPanel";
import CloudResourcesPanel from "../../components/CloudResourcesPanel";
import ReconnectOverlay from "../../components/ReconnectOverlay";
import LockScreen from "../../components/LockScreen";
import { getTeamClientInstance } from "../../composables/teamClientContext";
import { useGlobalShortcuts } from "../../composables/useGlobalShortcuts";
import { useLockScreen } from "../../composables/useLockScreen";
import type { TaskMessage } from "../../types";
import { defineAsyncComponent } from "vue";

const OrgView = defineAsyncComponent(() => import("../../components/OrgView"));

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
const { locked, unlock } = useLockScreen();

function handleSelectPeer(peerId: string) {
  // Switching sidebar tab clears the detail view
  selectedTask.value = null;
  detailReturnPeer.value = null;
  if (selectedPeer.value !== "__quick__" && !selectedPeer.value.startsWith("__settings_")) {
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
  useGlobalShortcuts(ctx);
}

const showReconnectOverlay = computed(() => {
  if (!ctx) return false;
  const s = ctx.status.value;
  return s === "disconnected" || s === "reconnecting" || s === "reconnect_failed";
});

function handleLogout() {
  if (!ctx) return;
  ctx.logout();
  router.replace("/");
}
</script>

<template>
  <div v-if="ctx" class="chat-view">
    <MemberSidebar
      :selected-peer="selectedPeer"
      @select="handleSelectPeer"
    />
    <SettingsProfile v-if="selectedPeer === '__settings_profile__'" @back="handleSettingsBack" />
    <SettingsTask v-else-if="selectedPeer === '__settings_task__'" @back="handleSettingsBack" />
    <SettingsAI v-else-if="selectedPeer === '__settings_ai__'" @back="handleSettingsBack" />
    <SettingsGeneral v-else-if="selectedPeer === '__settings_general__'" @back="handleSettingsBack" />
    <QuickSettingsPanel v-else-if="selectedPeer === '__quick__'" @back="handleSettingsBack" />
    <CloudResourcesPanel v-else-if="selectedPeer === '__cloud__'" />
    <OrgView v-else-if="selectedPeer === '__org__'" />
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
    <ReconnectOverlay
      v-if="showReconnectOverlay"
      :status="ctx.status.value as 'disconnected' | 'connecting' | 'reconnecting' | 'reconnect_failed'"
      :attempt="ctx.reconnectAttempt.value"
      @logout="handleLogout"
    />
    <LockScreen
      :locked="locked"
      :username="ctx.myId"
      @unlock="unlock"
    />
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
