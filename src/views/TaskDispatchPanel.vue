<script setup lang="ts">
import { inject, ref } from "vue";
import { TeamClientKey } from "../composables/teamClientContext";
import { useAI } from "../composables/useAI";

const ctx = inject(TeamClientKey)!;
const { members, dispatchTask } = ctx;

const { dispatchTask: aiDispatchTask, aiAvailable, aiError: dispatchAiError } = useAI();

const taskContent = ref("");
const dispatchPreview = ref<{ subscribe: string[]; content: string } | null>(null);
const dispatchLoading = ref(false);

async function handleSubmit() {
  const content = taskContent.value.trim();
  if (!content) return;

  if (members.value.length === 0) {
    dispatchAiError.value = "暂无成员在线，无法分派任务";
    return;
  }

  dispatchLoading.value = true;
  dispatchPreview.value = null;
  dispatchAiError.value = "";

  const memberList = members.value
    .filter((m) => m.status === "online")
    .map((m) => ({ id: m.id, responsibilities: m.responsibilities, capabilities: m.capabilities }));
  if (memberList.length === 0) {
    dispatchAiError.value = "暂无在线成员，无法分派任务";
    dispatchLoading.value = false;
    return;
  }
  const result = await aiDispatchTask(content, memberList);

  dispatchLoading.value = false;
  if (result) {
    dispatchPreview.value = result;
  }
}

function handleConfirm() {
  if (!dispatchPreview.value) return;
  const onlineIds = new Set(members.value.filter((m) => m.status === "online").map((m) => m.id));
  const subscribe = dispatchPreview.value.subscribe.filter((id) => onlineIds.has(id));
  if (subscribe.length === 0) {
    dispatchAiError.value = "匹配到的成员已全部离线，请稍后重试";
    return;
  }
  dispatchTask(subscribe, dispatchPreview.value.content);
  dispatchPreview.value = null;
  taskContent.value = "";
}

function handleCancel() {
  dispatchPreview.value = null;
}

function getMatchedMembers() {
  if (!dispatchPreview.value) return [];
  return members.value.filter((m) => dispatchPreview.value!.subscribe.includes(m.id));
}
</script>

<template>
  <div class="dispatch-panel">
    <div class="dispatch-header">
      <span class="header-name">任务分派</span>
    </div>

    <div class="dispatch-body">
    <!-- Online members preview -->
    <div class="section" v-if="members.length > 0">
      <h3 class="section-title">在线成员 ({{ members.length }})</h3>
      <div class="member-chips">
        <div v-for="m in members" :key="m.id" class="member-chip">
          <span class="chip-name">{{ m.id }}</span>
          <div class="chip-info">
            <span v-if="m.responsibilities" class="chip-desc">职责: {{ m.responsibilities }}</span>
            <span v-if="m.capabilities" class="chip-cap">能力: {{ m.capabilities }}</span>
            <span v-if="!m.responsibilities && !m.capabilities" class="chip-desc">无描述</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-members">
      暂无成员在线，无法分派任务
    </div>

    <!-- AI unavailable notice -->
    <div v-if="!aiAvailable" class="section">
      <div class="notice notice-warn">
        AI 服务未就绪，请检查 Manager 是否运行且已配置 AI API Key
      </div>
    </div>

    <!-- Task input -->
    <div class="section">
      <h3 class="section-title">任务描述</h3>
      <textarea
        v-model="taskContent"
        placeholder="描述你要分派的任务，AI 会自动匹配合适的成员..."
        rows="4"
        :disabled="dispatchLoading"
        @keydown.ctrl.enter="handleSubmit"
      />
      <div class="input-hint">Ctrl + Enter 提交</div>

      <!-- Error display -->
      <div v-if="dispatchAiError" class="notice notice-error">{{ dispatchAiError }}</div>

      <button
        class="btn-dispatch"
        :disabled="!taskContent.trim() || dispatchLoading || !aiAvailable"
        @click="handleSubmit"
      >
        <span v-if="dispatchLoading" class="spinner-small"></span>
        <span>{{ dispatchLoading ? 'AI 分析中...' : 'AI 智能分派' }}</span>
      </button>
    </div>

    <!-- Preview -->
    <div v-if="dispatchPreview" class="section">
      <h3 class="section-title">匹配结果</h3>
      <div class="preview-card">
        <div class="preview-content">{{ dispatchPreview.content }}</div>
        <div class="preview-members">
          <span class="preview-label">分派给：</span>
          <div class="matched-list">
            <div v-for="m in getMatchedMembers()" :key="m.id" class="matched-member">
              <span class="matched-name">{{ m.id }}</span>
              <div class="matched-info">
                <span v-if="m.responsibilities" class="matched-desc">{{ m.responsibilities }}</span>
                <span v-if="m.capabilities" class="matched-cap">{{ m.capabilities }}</span>
              </div>
            </div>
            <div v-if="dispatchPreview.subscribe.length === 0" class="no-match">
              无匹配成员，请调整任务描述或添加更多成员
            </div>
          </div>
        </div>
        <div class="preview-actions">
          <button class="btn-confirm" @click="handleConfirm" :disabled="dispatchPreview.subscribe.length === 0">
            确认分派
          </button>
          <button class="btn-cancel" @click="handleCancel">取消</button>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.dispatch-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
}

.dispatch-panel .section:last-child {
  margin-bottom: 0;
}

.dispatch-header {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}

.header-name {
  font-weight: 600;
  color: var(--text-primary);
}

.dispatch-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
}

.section {
  margin-bottom: var(--space-2xl);
}

.section-title {
  font-size: 0.9em;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--text-secondary);
}

.member-chips {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.member-chip {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.chip-name {
  font-weight: 600;
  color: var(--accent);
  min-width: 60px;
}

.chip-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.chip-desc {
  font-size: 0.85em;
  color: var(--text-muted);
}

.chip-cap {
  font-size: 0.82em;
  color: var(--accent);
  background: var(--accent-light);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  align-self: flex-start;
}

.empty-members {
  padding: var(--space-xl);
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85em;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

textarea {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-md);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-md);
  background: var(--bg-input);
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  font-size: 0.9em;
  resize: vertical;
  line-height: 1.6;
}

textarea:focus {
  border-color: var(--accent);
}

textarea::placeholder {
  color: var(--text-muted);
}

.input-hint {
  font-size: 0.75em;
  color: var(--text-muted);
  margin-top: var(--space-xs);
}

.btn-dispatch {
  margin-top: var(--space-md);
  width: 100%;
  padding: 12px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: 0.9em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  transition: background 0.15s;
}

.btn-dispatch:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-dispatch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notice {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  font-size: 0.85em;
  margin-top: var(--space-md);
}

.notice-warn {
  background: var(--warning-bg);
  border: 1px solid var(--warning-border);
  color: var(--warning);
}

.notice-error {
  background: var(--task-failed-bg);
  border: 1px solid var(--task-failed-border);
  color: var(--error);
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.preview-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
}

.preview-content {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border);
}

.preview-members {
  margin-bottom: var(--space-md);
}

.preview-label {
  font-size: 0.8em;
  font-weight: 600;
  color: var(--text-muted);
  display: block;
  margin-bottom: var(--space-sm);
}

.matched-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.matched-member {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: var(--accent-light);
  border-radius: var(--radius-sm);
}

.matched-name {
  font-weight: 600;
  color: var(--accent);
  font-size: 0.85em;
  white-space: nowrap;
}

.matched-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.matched-desc {
  font-size: 0.8em;
  color: var(--text-muted);
}

.matched-cap {
  font-size: 0.78em;
  color: var(--accent);
}

.no-match {
  color: var(--error);
  font-size: 0.85em;
  padding: var(--space-sm);
}

.preview-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.btn-confirm {
  padding: 8px var(--space-xl);
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: 0.85em;
  cursor: pointer;
}

.btn-confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  padding: 8px var(--space-xl);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 0.85em;
  cursor: pointer;
}

.btn-cancel:hover {
  color: var(--error);
}
</style>
