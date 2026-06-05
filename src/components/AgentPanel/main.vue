<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { AGENT_REGISTRY, type AgentRegistryEntry } from "../../agent/registry";
import { useExecutionMonitor } from "../../composables/useExecutionMonitor";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();
const { status, currentStage } = useExecutionMonitor();

const selectedAgentId = ref<string | null>(null);

const selectedAgent = computed(() =>
  AGENT_REGISTRY.find((a) => a.id === selectedAgentId.value) ?? null,
);

const roleDescMap: Record<string, string> = {
  planner: "agent.rolePlanner",
  executor: "agent.roleExecutor",
  reviewer: "agent.roleReviewer",
  scorer: "agent.roleScorer",
};

function isRunning(agentId: string): boolean {
  return status.value === "running" && currentStage.value === agentId;
}

function handleCardClick(agent: AgentRegistryEntry) {
  selectedAgentId.value = selectedAgentId.value === agent.id ? null : agent.id;
}
</script>

<template>
  <div class="agent-panel">
    <div class="panel-header">
      <SvgIcon name="grid" :size="16" />
      <span>{{ t('agent.title') }}</span>
    </div>

    <div class="agent-body">
      <div class="agent-grid-col">
        <div class="agent-grid">
          <button
            v-for="agent in AGENT_REGISTRY"
            :key="agent.id"
            class="agent-card"
            :class="{ active: selectedAgentId === agent.id, running: isRunning(agent.id) }"
            @click="handleCardClick(agent)"
          >
            <div class="card-icon-wrap" :class="'card-icon--' + agent.id">
              <SvgIcon :name="agent.icon" :size="22" />
            </div>
            <span class="agent-label">{{ agent.label }}</span>
            <span v-if="isRunning(agent.id)" class="agent-status-badge running">{{ t('agent.running') }}</span>
            <span class="agent-desc">{{ t(roleDescMap[agent.id] ?? '') }}</span>
          </button>
        </div>
      </div>

      <div class="agent-sidebar">
        <Transition name="fade" mode="out-in">
          <div v-if="selectedAgent" key="drawer" class="agent-drawer">
            <div class="drawer-header">
              <button class="drawer-back" @click="selectedAgentId = null">
                <SvgIcon name="chevron-left" :size="16" />
              </button>
              <div class="drawer-header-icon" :class="'card-icon--' + selectedAgent.id">
                <SvgIcon :name="selectedAgent.icon" :size="16" />
              </div>
              <div class="drawer-header-text">
                <span class="drawer-title">{{ selectedAgent.label }}</span>
                <span class="drawer-status" :class="{ running: isRunning(selectedAgent.id) }">
                  {{ isRunning(selectedAgent.id) ? t('agent.running') : t('agent.idle') }}
                </span>
              </div>
            </div>

            <div class="drawer-body">
              <div class="drawer-section">
                <h4 class="section-title">{{ t('agent.basicInfo') }}</h4>
                <div class="info-row">
                  <span class="info-label">{{ t('agent.maxSteps') }}</span>
                  <span class="info-value">{{ selectedAgent.maxSteps }}</span>
                </div>
              </div>

              <div class="drawer-section">
                <h4 class="section-title">{{ t('agent.tools') }}</h4>
                <div class="tool-list">
                  <span v-for="tool in selectedAgent.tools" :key="tool.name" class="tool-tag">
                    {{ tool.label }}
                  </span>
                </div>
              </div>

              <div class="drawer-section">
                <h4 class="section-title">{{ t('agent.instructions') }}</h4>
                <div class="instructions-block">{{ selectedAgent.instructions }}</div>
              </div>
            </div>
          </div>

          <div v-else key="placeholder" class="agent-placeholder">
            <SvgIcon name="grid" :size="32" class="placeholder-icon" />
            <p>{{ t('agent.noSelection') }}</p>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
