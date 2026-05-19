<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocale } from "../i18n";
import { getMemberSettings, TeamClientKey, setTeamClientInstance } from "../composables/teamClientContext";
import type { TaskExecutionMode } from "../composables/useMemberSettings";
import { useUserProfile } from "../composables/useUserProfile";
import GlassSelect from "./GlassSelect.vue";
import GlassCheckbox from "./GlassCheckbox.vue";
import GlassButton from "./GlassButton.vue";
import BackButton from "./BackButton.vue";

useI18n();
const { locale, switchLocale } = useLocale();
const currentLocale = ref(locale.value);
watch(currentLocale, (val) => switchLocale(val as "zh-CN" | "en"));

const emit = defineEmits<{
  back: [];
}>();

const { settings, loadSettings, saveSettings } = getMemberSettings();
const ctx = inject(TeamClientKey)!;
const router = useRouter();

const username = ctx.myId;

const { updateMyProfile, uploadMyAvatar, getAvatarUrl, getDisplayName } = useUserProfile();
const avatarUrl = computed(() => getAvatarUrl(username));
const displayName = computed(() => getDisplayName(username));
const nickname = ref("");
const nicknameSaving = ref(false);
const avatarUploading = ref(false);
let avatarInput: HTMLInputElement | null = null;

const executionMode = ref<TaskExecutionMode>("auto");
const workingDirectory = ref("");
const aiHistoryCount = ref(5);
const aiAutoReply = ref(false);
const saving = ref(false);
const showLogoutConfirm = ref(false);

onMounted(async () => {
  await loadSettings(username);
  executionMode.value = settings.value.task_execution_mode;
  workingDirectory.value = settings.value.working_directory;
  aiHistoryCount.value = settings.value.ai_suggestion_history_count;
  aiAutoReply.value = settings.value.ai_auto_reply;
  nickname.value = getDisplayName(username);
});

async function saveNickname() {
  const trimmed = nickname.value.trim();
  if (trimmed === getDisplayName(username)) return;
  nicknameSaving.value = true;
  try {
    await updateMyProfile(username, { nickname: trimmed || null });
  } catch {
    nickname.value = getDisplayName(username);
  }
  nicknameSaving.value = false;
}

function triggerAvatarUpload() {
  if (!avatarInput) {
    avatarInput = document.createElement("input");
    avatarInput.type = "file";
    avatarInput.accept = "image/*";
    avatarInput.addEventListener("change", handleAvatarFile);
  }
  avatarInput.value = "";
  avatarInput.click();
}

async function handleAvatarFile(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  avatarUploading.value = true;
  try {
    await uploadMyAvatar(username, file);
  } catch {
    // silently fail
  }
  avatarUploading.value = false;
}

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

watch(aiAutoReply, async (val) => {
  if (val === settings.value.ai_auto_reply) return;
  saving.value = true;
  try {
    await saveSettings(username, { ai_auto_reply: val });
    if (!val) {
      ctx.autoReplyDispose?.();
    }
  } catch {
    aiAutoReply.value = settings.value.ai_auto_reply;
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
      <span class="header-title">{{ $t('settings.title') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="settings-body">
      <!-- Profile section (no group header, visual card already separates it) -->
      <div class="profile-section">
        <div class="profile-avatar-wrapper" @click="triggerAvatarUpload" :title="$t('settings.changeAvatar')">
          <img v-if="avatarUrl" :src="avatarUrl" class="profile-avatar-img" alt="" />
          <div v-else class="profile-avatar-fallback">{{ username.charAt(0).toUpperCase() }}</div>
          <div v-if="avatarUploading" class="profile-avatar-overlay">{{ $t('common.loading') }}</div>
          <div class="profile-avatar-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        </div>
        <div class="profile-fields">
          <div class="setting-group">
            <label class="setting-label">{{ $t('settings.nickname') }}</label>
            <div class="nickname-row">
              <input
                v-model="nickname"
                type="text"
                class="setting-input"
                :placeholder="$t('settings.nicknamePlaceholder')"
                @keydown.enter="saveNickname"
              />
              <GlassButton
                variant="primary"
                :disabled="nicknameSaving || nickname.trim() === displayName"
                @click="saveNickname"
              >{{ $t('common.save') }}</GlassButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Task & Agent -->
      <section class="settings-section">
        <h4 class="section-title">{{ $t('settings.groupTask') }}</h4>
        <div class="section-body">
          <div class="setting-group">
            <label class="setting-label">{{ $t('settings.taskMode') }}</label>
            <GlassSelect v-model="executionMode">
              <option value="manual">{{ $t('settings.manual') }}</option>
              <option value="auto">{{ $t('settings.auto') }}</option>
            </GlassSelect>
            <p class="setting-hint">
              {{ executionMode === 'auto' ? $t('settings.autoHint') : $t('settings.manualHint') }}
            </p>
          </div>

          <div class="setting-group">
            <label class="setting-label">{{ $t('settings.workingDirectory') }}</label>
            <input
              v-model="workingDirectory"
              type="text"
              class="setting-input"
              :placeholder="$t('settings.workingDirectoryPlaceholder')"
              @blur="saveWorkingDirectory"
              @keydown.enter="saveWorkingDirectory"
            />
            <p class="setting-hint">{{ $t('settings.workingDirectoryHint') }}</p>
          </div>
        </div>
      </section>

      <!-- AI Assistant -->
      <section class="settings-section">
        <h4 class="section-title">{{ $t('settings.groupAI') }}</h4>
        <div class="section-body">
          <div class="setting-group">
            <label class="setting-label">{{ $t('settings.aiAutoReply') }}</label>
            <GlassCheckbox v-model="aiAutoReply">{{ $t('settings.aiAutoReplyDesc') }}</GlassCheckbox>
            <p class="setting-hint">{{ $t('settings.aiAutoReplyHint') }}</p>
          </div>

          <div class="setting-group">
            <label class="setting-label">{{ $t('settings.aiHistoryCount') }}</label>
            <input
              v-model.number="aiHistoryCount"
              type="number"
              class="setting-input"
              min="1"
              max="50"
              @blur="saveAiHistoryCount"
              @keydown.enter="saveAiHistoryCount"
            />
            <p class="setting-hint">{{ $t('settings.aiHistoryCountHint') }}</p>
          </div>
        </div>
      </section>

      <!-- General -->
      <section class="settings-section">
        <h4 class="section-title">{{ $t('settings.groupGeneral') }}</h4>
        <div class="section-body">
          <div class="setting-group">
            <label class="setting-label">{{ $t('settings.language') }}</label>
            <GlassSelect v-model="currentLocale">
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </GlassSelect>
          </div>
        </div>
      </section>
    </div>

    <div class="settings-footer">
      <div class="user-card">
        <img v-if="avatarUrl" :src="avatarUrl" class="user-avatar user-avatar-img" alt="" />
        <div v-else class="user-avatar">{{ username.charAt(0).toUpperCase() }}</div>
        <div class="user-meta">
          <span class="user-name">{{ displayName }}</span>
          <span class="user-role" :class="ctx.role">{{ ctx.role }}</span>
        </div>
        <button class="logout-btn" :title="$t('settings.logout')" @click="showLogoutConfirm = true">
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
            <h3 class="logout-title">{{ $t('settings.logoutTitle') }}</h3>
            <p class="logout-desc">{{ $t('settings.logoutDesc') }}</p>
            <div class="logout-actions">
              <button class="btn btn-cancel" @click="showLogoutConfirm = false">{{ $t('common.cancel') }}</button>
              <button class="btn btn-danger" @click="handleLogout">{{ $t('settings.logout') }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <div v-if="saving" class="saving-indicator">{{ $t('settings.saving') }}</div>
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
  gap: var(--space-lg);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.section-title {
  margin: 0;
  font-size: 0.78em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-md);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
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
  background: var(--glass-bg-light);
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

.profile-section {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
  padding: var(--space-lg);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}

.profile-avatar-wrapper {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
  border: 2px solid var(--glass-border);
  transition: border-color 0.15s;
}

.profile-avatar-wrapper:hover {
  border-color: var(--accent);
}

.profile-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 700;
  font-size: 1.5em;
}

.profile-avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-bg);
  color: var(--text-secondary);
  font-size: 0.65em;
  font-weight: 500;
}

.profile-avatar-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: color 0.15s;
}

.profile-avatar-wrapper:hover .profile-avatar-badge {
  color: var(--accent);
}

.profile-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.profile-fields .setting-group {
  gap: var(--space-xs);
}

.nickname-row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.nickname-row .setting-input {
  flex: 1;
  min-width: 0;
}

.saving-indicator {
  position: absolute;
  bottom: var(--space-md);
  right: var(--space-lg);
  font-size: 0.78em;
  color: var(--text-muted);
  background: var(--glass-bg-light);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
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

.user-avatar.user-avatar-img {
  background: none;
  padding: 0;
  object-fit: cover;
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
  color: var(--text-on-accent);
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
