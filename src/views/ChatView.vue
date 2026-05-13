<script setup lang="ts">
import { ref, provide } from "vue";
import { useRouter } from "vue-router";
import MemberSidebar from "../components/MemberSidebar.vue";
import ChatPanel from "../components/ChatPanel.vue";
import TaskCenterView from "./TaskCenterView.vue";
import TaskDispatchPanel from "./TaskDispatchPanel.vue";
import { TeamClientKey, getTeamClientInstance } from "../composables/teamClientContext";

const router = useRouter();
const ctx = getTeamClientInstance();

if (!ctx) {
  router.replace("/");
}

const selectedPeer = ref("__tasks__");

function handleSelectPeer(peerId: string) {
  selectedPeer.value = peerId;
}

if (ctx) {
  provide(TeamClientKey, ctx);
}
</script>

<template>
  <div v-if="ctx" class="chat-view">
    <MemberSidebar
      :selected-peer="selectedPeer"
      @select="handleSelectPeer"
    />
    <TaskDispatchPanel v-if="selectedPeer === '__dispatch__'" />
    <TaskCenterView v-else-if="selectedPeer === '__tasks__'" />
    <ChatPanel v-else :peer-id="selectedPeer" />
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
