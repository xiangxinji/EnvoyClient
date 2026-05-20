<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocale } from "../../i18n";
import { getMemberSettings, getTeamClientInstance, setTeamClientInstance } from "../../composables/teamClientContext";
import type { TaskExecutionMode } from "../../composables/useMemberSettings";
import { useConfirm } from "../../composables/useConfirm";
import { useUserProfile } from "../../composables/useUserProfile";
import { pickFiles } from "../../utils/filePicker";
import GlassSelect from "../GlassSelect";
import GlassCheckbox from "../GlassCheckbox";
import GlassButton from "../GlassButton";
import BackButton from "../BackButton";
import ConfirmDialog from "../ConfirmDialog";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();
const { locale, switchLocale } = useLocale();
const currentLocale = ref(locale.value);
watch(currentLocale, (val) => switchLocale(val as "zh-CN" | "en"));

const emit = defineEmits<{
  back: [];
}>();

const { settings, loadSettings, saveSettings } = getMemberSettings();
const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();
const ctx = getTeamClientInstance()!;
const router = useRouter();

const username = ctx.myId;

const { updateMyProfile, uploadMyAvatar, getAvatarUrl, getDisplayName, getInitial } = useUserProfile();
const avatarUrl = computed(() => getAvatarUrl(username));
const displayName = computed(() => getDisplayName(username));
const nickname = ref("");
const nicknameSaving = ref(false);
const avatarUploading = ref(false);

const executionMode = ref<TaskExecutionMode>("auto");
const workingDirectory = ref("");
const aiHistoryCount = ref(5);
const aiAutoReply = ref(false);
const saving = ref(false);

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

async function triggerAvatarUpload() {
  const files = await pickFiles({ accept: "image/*" });
  const file = files[0];
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

function requestLogout() {
  showConfirm(t('settings.logoutTitle'), t('settings.logoutDesc'), handleLogout, true);
}

async function handleLogout() {
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
          <div v-else class="profile-avatar-fallback">{{ getInitial(username) }}</div>
          <div v-if="avatarUploading" class="profile-avatar-overlay">{{ $t('common.loading') }}</div>
          <div class="profile-avatar-badge">
            <SvgIcon name="camera" :size="12" />
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
        <div v-else class="user-avatar">{{ getInitial(username) }}</div>
        <div class="user-meta">
          <span class="user-name">{{ displayName }}</span>
          <span class="user-role" :class="ctx.role">{{ ctx.role }}</span>
        </div>
        <button class="logout-btn" :title="$t('settings.logout')" @click="requestLogout">
          <SvgIcon name="log-out" :size="18" />
        </button>
      </div>
    </div>

    <ConfirmDialog
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :danger="confirmDanger"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />

    <div v-if="saving" class="saving-indicator">{{ $t('settings.saving') }}</div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
