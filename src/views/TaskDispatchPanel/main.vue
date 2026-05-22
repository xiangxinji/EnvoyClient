<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { getTeamClientInstance } from "../../composables/teamClientContext";
import { useAITask } from "../../composables/useAITask";
import GlassButton from "../../components/GlassButton";
import { useMouseGradient } from "../../composables/useMouseGradient";

const ctx = getTeamClientInstance()!;
const { members, dispatchTask } = ctx;
const { t } = useI18n();

const { dispatchTask: aiDispatchTask, aiAvailable, aiError: dispatchAiError } = useAITask();

const taskContent = ref("");
const dispatchPreview = ref<{ subscribe: string[]; content: string } | null>(null);
const dispatchLoading = ref(false);
const sectionRef = ref<HTMLElement | null>(null);
const { onMouseMove, onMouseLeave } = useMouseGradient(sectionRef, {
  radius: 200,
  opacity: 0.12,
});

async function handleSubmit() {
  const content = taskContent.value.trim();
  if (!content) return;

  if (members.value.length === 0) {
    dispatchAiError.value = t('task.dispatch.noMembersOnline');
    return;
  }

  dispatchLoading.value = true;
  dispatchPreview.value = null;
  dispatchAiError.value = "";

  const memberList = members.value
    .filter((m) => m.status === "online")
    .map((m) => ({ id: m.id, responsibilities: m.responsibilities, capabilities: m.capabilities }));
  if (memberList.length === 0) {
    dispatchAiError.value = t('task.dispatch.noOnlineMembers');
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
    dispatchAiError.value = t('task.dispatch.allOffline');
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
      <span class="header-name">{{ $t('task.dispatch.title') }}</span>
    </div>

    <div class="dispatch-body">
    <!-- Online members preview -->
    <div class="section" v-if="members.length > 0">
      <h3 class="section-title">{{ $t('task.dispatch.onlineMembers', { count: members.length }) }}</h3>
      <div class="member-chips">
        <div v-for="m in members" :key="m.id" class="member-chip">
          <span class="chip-name">{{ m.id }}</span>
          <div class="chip-info">
            <span v-if="m.responsibilities" class="chip-desc">{{ $t('task.dispatch.responsibilities', { text: m.responsibilities }) }}</span>
            <span v-if="m.capabilities" class="chip-cap">{{ $t('task.dispatch.capabilities', { text: m.capabilities }) }}</span>
            <span v-if="!m.responsibilities && !m.capabilities" class="chip-desc">{{ $t('task.dispatch.noDesc') }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-members">
      {{ $t('task.dispatch.noMembersOnline') }}
    </div>

    <!-- AI unavailable notice -->
    <div v-if="!aiAvailable" class="section">
      <div class="notice notice-warn">
        {{ $t('task.dispatch.aiNotReady') }}
      </div>
    </div>

    <!-- Task input -->
    <div class="section">
      <h3 class="section-title">{{ $t('task.dispatch.taskDescription') }}</h3>
      <textarea
        v-model="taskContent"
        :placeholder="$t('task.dispatch.taskPlaceholder')"
        rows="4"
        :disabled="dispatchLoading"
        @keydown.ctrl.enter="handleSubmit"
      />
      <div class="input-hint">{{ $t('task.dispatch.submitHint') }}</div>

      <!-- Error display -->
      <div v-if="dispatchAiError" class="notice notice-error">{{ dispatchAiError }}</div>

      <GlassButton
        variant="primary"
        class="btn-dispatch"
        :disabled="!taskContent.trim() || !aiAvailable"
        :loading="dispatchLoading"
        @click="handleSubmit"
      >
        <span>{{ dispatchLoading ? $t('task.dispatch.aiAnalyzing') : $t('task.dispatch.aiSmartDispatch') }}</span>
      </GlassButton>
    </div>

    <!-- Preview -->
    <div v-if="dispatchPreview" class="section">
      <h3 class="section-title">{{ $t('task.dispatch.matchResult') }}</h3>
      <div ref="sectionRef" class="preview-card" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
        <div class="preview-content">{{ dispatchPreview.content }}</div>
        <div class="preview-members">
          <span class="preview-label">{{ $t('task.dispatch.assignTo') }}</span>
          <div class="matched-list">
            <div v-for="m in getMatchedMembers()" :key="m.id" class="matched-member">
              <span class="matched-name">{{ m.id }}</span>
              <div class="matched-info">
                <span v-if="m.responsibilities" class="matched-desc">{{ m.responsibilities }}</span>
                <span v-if="m.capabilities" class="matched-cap">{{ m.capabilities }}</span>
              </div>
            </div>
            <div v-if="dispatchPreview.subscribe.length === 0" class="no-match">
              {{ $t('task.dispatch.noMatch') }}
            </div>
          </div>
        </div>
        <div class="preview-actions">
          <GlassButton variant="primary" :disabled="dispatchPreview.subscribe.length === 0" @click="handleConfirm">
            {{ $t('task.dispatch.confirmDispatch') }}
          </GlassButton>
          <GlassButton variant="default" @click="handleCancel">{{ $t('common.cancel') }}</GlassButton>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
