<script setup lang="ts">
import { ref, onMounted, watch, inject } from "vue";
import { useRouter } from "vue-router";
import { getMemberSettings, TeamClientKey, setTeamClientInstance } from "../composables/teamClientContext";
import type { TaskExecutionMode } from "../composables/useMemberSettings";
import GlassSelect from "./GlassSelect.vue";
import BackButton from "./BackButton.vue";

const emit = defineEmits<{
  back: [];
}>();

const { settings, loadSettings, saveSettings } = getMemberSettings();
const ctx = inject(TeamClientKey)!;
const router = useRouter();

const username = ctx.myId;

const executionMode = ref<TaskExecutionMode>("auto");
const workingDirectory = ref("");
const aiHistoryCount = ref(5);
const saving = ref(false);
const showLogoutConfirm = ref(false);

onMounted(async () => {
  await loadSettings(username);
  executionMode.value = settings.value.task_execution_mode;
  workingDirectory.value = settings.value.working_directory;
  aiHistoryCount.value = settings.value.ai_suggestion_history_count;
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

async function saveAiHistoryCount() {
  const val = Math.max(1, Math.min(50, Math.floor(aiHistoryCount.value) || 5));
  aiHistoryCount.value = val;
  if (val === settings.value.ai_suggestion_history_count) return;
  saving.value = true;
  try {
    await saveSettings(username, { ai_suggestion_history_count: val });
  } catch {
    aiHistoryCount.value = settings.value.ai_suggestion_history_count;
  }
  saving.value = false;
}

async function handleLogout() {
  showLogoutConfirm.value = false;
  try {
    await ctx.disconnect();
  } catch {}
  setTeamClientInstance(null);
  router.replace("/");
}
</script>

<template>
  <div class="settings-panel">
    <div class="settings-header">
      <span class="header-title">设置</span>
      <BackButton @click="emit('back')" />
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

      <div class="setting-group">
        <label class="setting-label">AI 建议历史条数</label>
        <input
          v-model.number="aiHistoryCount"
          type="number"
          class="setting-input"
          min="1"
          max="50"
          @blur="saveAiHistoryCount"
          @keydown.enter="saveAiHistoryCount"
        />
        <p class="setting-hint">生成 AI 回复建议时读取的最近聊天记录条数，默认 5</p>
      </div>
    </div>

    <div class="settings-footer">
      <div class="user-card">
        <div class="user-avatar">{{ username.charAt(0).toUpperCase() }}</div>
        <div class="user-meta">
          <span class="user-name">{{ username }}</span>
          <span class="user-role" :class="ctx.role">{{ ctx.role }}</span>
        </div>
        <button class="logout-btn" title="退出登录" @click="showLogoutConfirm = true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="logout">
        <div v-if="showLogoutConfirm" class="logout-overlay" @click.self="showLogoutConfirm = false">
          <div class="logout-dialog">
            <div class="logout-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <h3 class="logout-title">退出登录</h3>
            <p class="logout-desc">将断开与团队的连接并返回登录页</p>
            <div class="logout-actions">
              <button class="btn btn-cancel" @click="showLogoutConfirm = false">取消</button>
              <button class="btn btn-danger" @click="handleLogout">退出登录</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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

.settings-footer {
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--glass-border);
}

.user-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  border-radius: var(--radius-md);
  transition: background 0.15s;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.8em;
  flex-shrink: 0;
}

.user-meta {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  min-width: 0;
}

.user-name {
  font-size: 0.88em;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  font-size: 0.65em;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  flex-shrink: 0;
}

.user-role.leader {
  background: var(--role-leader-bg);
  color: var(--role-leader-text);
}

.user-role.member {
  background: var(--role-member-bg);
  color: var(--role-member-text);
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.logout-btn:hover {
  background: var(--glass-bg-light);
  color: var(--error);
}

.logout-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.logout-dialog {
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-xl) var(--space-2xl);
  min-width: 320px;
  box-shadow: var(--glass-shadow-heavy);
  text-align: center;
}

.logout-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--glass-bg-light);
  color: var(--error);
  margin-bottom: var(--space-md);
}

.logout-title {
  margin: 0 0 var(--space-xs);
  font-size: 1.05em;
  font-weight: 600;
  color: var(--text-primary);
}

.logout-desc {
  margin: 0 0 var(--space-lg);
  font-size: 0.88em;
  color: var(--text-secondary);
}

.logout-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
}

.btn {
  padding: 7px 20px;
  border-radius: var(--radius-sm);
  border: none;
  font-size: 0.88em;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn:hover {
  opacity: 0.88;
}

.btn-cancel {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.btn-danger {
  background: var(--error);
  color: #fff;
}

.logout-enter-active {
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.logout-enter-active .logout-dialog {
  transition:
    transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.logout-leave-active {
  transition: opacity 0.18s cubic-bezier(0.4, 0, 1, 1);
}
.logout-leave-active .logout-dialog {
  transition:
    transform 0.18s cubic-bezier(0.4, 0, 1, 1),
    filter 0.18s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.18s cubic-bezier(0.4, 0, 1, 1);
}
.logout-enter-from {
  opacity: 0;
}
.logout-enter-from .logout-dialog {
  transform: scale(0.94);
  filter: blur(8px);
  opacity: 0;
}
.logout-leave-to {
  opacity: 0;
}
.logout-leave-to .logout-dialog {
  transform: scale(0.97);
  filter: blur(4px);
  opacity: 0;
}
</style>
