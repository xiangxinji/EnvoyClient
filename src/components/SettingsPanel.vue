<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { getMemberSettings } from "../composables/teamClientContext";
import type { TaskExecutionMode } from "../composables/useMemberSettings";
import GlassSelect from "./GlassSelect.vue";

const emit = defineEmits<{
  back: [];
}>();

const { settings, loadSettings, saveSettings } = getMemberSettings();

// Get username from team client context
import { inject } from "vue";
import { TeamClientKey } from "../composables/teamClientContext";

const ctx = inject(TeamClientKey)!;
const username = ctx.myId;

const executionMode = ref<TaskExecutionMode>("auto");
const workingDirectory = ref("");
const saving = ref(false);

onMounted(async () => {
  await loadSettings(username);
  executionMode.value = settings.value.task_execution_mode;
  workingDirectory.value = settings.value.working_directory;
});

watch(executionMode, async (val) => {
  if (val === settings.value.task_execution_mode) return;
  saving.value = true;
  try {
    await saveSettings(username, { task_execution_mode: val });
  } catch {
    executionMode.value = settings.value.task_execution_mode;
  }
  saving.value = false;
});

async function saveWorkingDirectory() {
  if (workingDirectory.value === settings.value.working_directory) return;
  saving.value = true;
  try {
    await saveSettings(username, { working_directory: workingDirectory.value });
  } catch {
    workingDirectory.value = settings.value.working_directory;
  }
  saving.value = false;
}
</script>

<template>
  <div class="settings-panel">
    <div class="settings-header">
      <span class="header-title">设置</span>
      <button class="back-btn" @click="emit('back')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        返回
      </button>
    </div>

    <div class="settings-body">
      <div class="setting-group">
        <label class="setting-label">任务执行模式</label>
        <GlassSelect v-model="executionMode">
          <option value="manual">手动</option>
          <option value="auto">自动接管</option>
        </GlassSelect>
        <p class="setting-hint">
          {{ executionMode === 'auto' ? 'AI 将自动处理收到的任务' : '收到任务后需手动操作' }}
        </p>
      </div>

      <div class="setting-group">
        <label class="setting-label">工作目录</label>
        <input
          v-model="workingDirectory"
          type="text"
          class="setting-input"
          placeholder="留空使用默认 ~/.envoy/workspace/{username}"
          @blur="saveWorkingDirectory"
          @keydown.enter="saveWorkingDirectory"
        />
        <p class="setting-hint">Agent 执行命令的根目录，不填则使用默认路径</p>
      </div>
    </div>

    <div v-if="saving" class="saving-indicator">保存中...</div>
  </div>
</template>

<style scoped>
.settings-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
}

.settings-header {
  position: relative;
  z-index: 10;
  height: 52px;
  box-sizing: border-box;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-left: auto;
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.85em;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}

.back-btn:hover {
  background: var(--bg-secondary);
}

.header-title {
  font-weight: 600;
  color: var(--text-primary);
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.setting-label {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-input {
  padding: 0 14px;
  height: 36px;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.9em;
  outline: none;
  transition: border-color 0.15s;
}

.setting-input::placeholder {
  color: var(--text-muted);
}

.setting-input:focus {
  border-color: var(--accent);
}

.setting-hint {
  margin: 0;
  font-size: 0.78em;
  color: var(--text-muted);
  line-height: 1.4;
}

.saving-indicator {
  position: absolute;
  bottom: var(--space-md);
  right: var(--space-lg);
  font-size: 0.78em;
  color: var(--text-muted);
  background: var(--bg-secondary);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
</style>
