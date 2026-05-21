<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getMemberSettings, getTeamClientInstance, setTeamClientInstance } from "../../composables/teamClientContext";
import { useConfirm } from "../../composables/useConfirm";
import { useUserProfile } from "../../composables/useUserProfile";
import { pickFiles } from "../../utils/filePicker";
import GlassButton from "../GlassButton";
import BackButton from "../BackButton";
import ConfirmDialog from "../ConfirmDialog";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();
const emit = defineEmits<{ back: [] }>();

const { loadSettings } = getMemberSettings();
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

onMounted(async () => {
  await loadSettings(username);
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
      <span class="header-title">{{ t('sidebar.profile') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="settings-body">
      <div class="profile-section">
        <div class="profile-avatar-wrapper" @click="triggerAvatarUpload" :title="t('settings.changeAvatar')">
          <img v-if="avatarUrl" :src="avatarUrl" class="profile-avatar-img" alt="" />
          <div v-else class="profile-avatar-fallback">{{ getInitial(username) }}</div>
          <div v-if="avatarUploading" class="profile-avatar-overlay">{{ t('common.loading') }}</div>
          <div class="profile-avatar-badge">
            <SvgIcon name="camera" :size="12" />
          </div>
        </div>
        <div class="profile-fields">
          <div class="setting-group">
            <label class="setting-label">{{ t('settings.nickname') }}</label>
            <div class="nickname-row">
              <input
                v-model="nickname"
                type="text"
                class="setting-input"
                :placeholder="t('settings.nicknamePlaceholder')"
                @keydown.enter="saveNickname"
              />
              <GlassButton
                variant="primary"
                :disabled="nicknameSaving || nickname.trim() === displayName"
                @click="saveNickname"
              >{{ t('common.save') }}</GlassButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <div class="user-card">
        <img v-if="avatarUrl" :src="avatarUrl" class="user-avatar user-avatar-img" alt="" />
        <div v-else class="user-avatar">{{ getInitial(username) }}</div>
        <div class="user-meta">
          <span class="user-name">{{ displayName }}</span>
          <span class="user-role" :class="ctx.role">{{ ctx.role }}</span>
        </div>
        <button class="logout-btn" :title="t('settings.logout')" @click="requestLogout">
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
  </div>
</template>

<style scoped>
@import '../SettingsPanel/styles.css';
</style>
