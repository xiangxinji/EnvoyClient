<script setup lang="ts">
import { ref, computed } from "vue";
import { AGENT_REGISTRY, type AgentRegistryEntry } from "../../agent/registry";
import { useExecutionMonitor } from "../../composables/useExecutionMonitor";
import SvgIcon from "../SvgIcon";

const { status, currentStage } = useExecutionMonitor();

const selectedAgentId = ref<string | null>(null);

const selectedAgent = computed(() =>
  AGENT_REGISTRY.find((a) => a.id === selectedAgentId.value) ?? null,
);

function isRunning(agentId: string): boolean {
  return status.value === "running" && currentStage.value === agentId;
}

function handleCardClick(agent: AgentRegistryEntry) {
  selectedAgentId.value = selectedAgentId.value === agent.id ? null : agent.id;
}
</script>

<template>
  <div class="agent-panel">
    <div class="agent-header">
      <h2 class="agent-title">Agents</h2>
    </div>

    <div class="agent-grid">
      <button
        v-for="agent in AGENT_REGISTRY"
        :key="agent.id"
        class="agent-card"
        :class="{ active: selectedAgentId === agent.id }"
        @click="handleCardClick(agent)"
      >
        <span class="agent-status-dot" :class="{ running: isRunning(agent.id) }"></span>
        <SvgIcon :name="agent.icon" :size="24" />
        <span class="agent-label">{{ agent.label }}</span>
      </button>
    </div>

    <Transition name="drawer">
      <div v-if="selectedAgent" class="agent-drawer">
        <div class="drawer-header">
          <button class="drawer-back" @click="selectedAgentId = null">
            <SvgIcon name="chevron-left" :size="16" />
          </button>
          <SvgIcon :name="selectedAgent.icon" :size="18" />
          <span class="drawer-title">{{ selectedAgent.label }}</span>
          <span
            class="drawer-status"
            :class="{ running: isRunning(selectedAgent.id) }"
          >
            {{ isRunning(selectedAgent.id) ? "运行中" : "空闲" }}
          </span>
        </div>

        <div class="drawer-body">
          <div class="drawer-section">
            <h4 class="section-title">基本信息</h4>
            <div class="info-row">
              <span class="info-label">步骤上限</span>
              <span class="info-value">{{ selectedAgent.maxSteps }}</span>
            </div>
          </div>

          <div class="drawer-section">
            <h4 class="section-title">可用工具</h4>
            <div class="tool-list">
              <span v-for="tool in selectedAgent.tools" :key="tool.name" class="tool-tag">
                {{ tool.label }}
              </span>
            </div>
          </div>

          <div class="drawer-section">
            <h4 class="section-title">提示词</h4>
            <div class="instructions-block">{{ selectedAgent.instructions }}</div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
