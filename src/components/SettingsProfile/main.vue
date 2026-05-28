<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getMemberSettings, getTeamClientInstance } from "../../composables/teamClientContext";
import { useConfirm } from "../../composables/useConfirm";
import { useUserProfile } from "../../composables/useUserProfile";
import { useToast } from "../../composables/useToast";
import { useLockScreen } from "../../composables/useLockScreen";
import { pickFiles } from "../../utils/filePicker";
import GlassButton from "../GlassButton";
import GlassInput from "../GlassInput";
import BackButton from "../BackButton";
import ConfirmDialog from "../ConfirmDialog";
import Toast from "../Toast";
import SvgIcon from "../SvgIcon";
import { useMouseGradient } from "../../composables/useMouseGradient";

const { t } = useI18n();
const emit = defineEmits<{ back: [] }>();

const { loadSettings } = getMemberSettings();
const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();
const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();
const { lock } = useLockScreen();
const ctx = getTeamClientInstance()!;
const router = useRouter();

const username = ctx.myId;
const { updateMyProfile, uploadMyAvatar, getAvatarUrl, getDisplayName, getInitial, getProfile, loadProfiles, syncFromMembers } = useUserProfile();
const avatarUrl = computed(() => getAvatarUrl(username));
const displayName = computed(() => getDisplayName(username));
const nickname = ref("");
const capabilities = ref("");
const responsibilities = ref("");
const nicknameSaving = ref(false);
const avatarUploading = ref(false);
const userCardRef = ref<HTMLElement | null>(null);
const { onMouseMove: onCardMouseMove, onMouseLeave: onCardMouseLeave } = useMouseGradient(userCardRef, {
  radius: 200,
  opacity: 0.12,
});

onMounted(async () => {
  await loadSettings(username);
  await loadProfiles([username]);
  const profile = getProfile(username);
  nickname.value = getDisplayName(username);
  capabilities.value = profile?.capabilities ?? "";
  responsibilities.value = profile?.responsibilities ?? "";
});

async function saveNickname() {
  const trimmed = nickname.value.trim();
  if (trimmed === getDisplayName(username)) return;
  nicknameSaving.value = true;
  try {
    await updateMyProfile(username, { nickname: trimmed || null });
    await ctx.loadConfiguredMembers();
    syncFromMembers(ctx.configuredMembers.value);
  } catch {
    nickname.value = getDisplayName(username);
  }
  nicknameSaving.value = false;
}

async function saveProfile() {
  const caps = capabilities.value.trim();
  const resp = responsibilities.value.trim();
  const profile = getProfile(username);
  if (caps === (profile?.capabilities ?? "") && resp === (profile?.responsibilities ?? "")) {
    showToast(t('common.saved'), "success");
    return;
  }
  try {
    await updateMyProfile(username, { capabilities: caps, responsibilities: resp });
    await ctx.loadConfiguredMembers();
    syncFromMembers(ctx.configuredMembers.value);
    showToast(t('common.saved'), "success");
  } catch (e) {
    console.error("[saveProfile] failed:", e);
    const p = getProfile(username);
    capabilities.value = p?.capabilities ?? "";
    responsibilities.value = p?.responsibilities ?? "";
    showToast(t('common.operationFailed'), "error");
  }
}

async function triggerAvatarUpload() {
  const files = await pickFiles({ accept: "image/*" });
  const file = files[0];
  if (!file) return;
  avatarUploading.value = true;
  try {
    await uploadMyAvatar(username, file);
    // Refresh configured members so sidebar avatar updates immediately
    await ctx.loadConfiguredMembers();
    syncFromMembers(ctx.configuredMembers.value);
  } catch {
    // silently fail
  }
  avatarUploading.value = false;
}

function requestLogout() {
  showConfirm(t('settings.logoutTitle'), t('settings.logoutDesc'), handleLogout, true);
}

async function handleLogout() {
  ctx.logout();
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
              <GlassInput
                v-model="nickname"
                type="text"
                :placeholder="t('settings.nicknamePlaceholder')"
                @keydown="saveNickname"
              />
              <GlassButton
                variant="primary"
                :disabled="nicknameSaving || nickname.trim() === displayName"
                @click="saveNickname"
              >{{ t('common.save') }}</GlassButton>
            </div>
          </div>

          <div class="setting-group">
            <label class="setting-label">{{ t('settings.capabilities') }}</label>
            <textarea
              v-model="capabilities"
              class="setting-textarea"
              :placeholder="t('settings.capabilitiesPlaceholder')"
              rows="3"
            />
          </div>

          <div class="setting-group">
            <label class="setting-label">{{ t('settings.responsibilities') }}</label>
            <textarea
              v-model="responsibilities"
              class="setting-textarea"
              :placeholder="t('settings.responsibilitiesPlaceholder')"
              rows="3"
            />
          </div>

          <div class="setting-group profile-actions">
            <GlassButton
              variant="primary"
              @click="saveProfile"
            >{{ t('common.save') }}</GlassButton>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <div ref="userCardRef" class="user-card" @mousemove="onCardMouseMove" @mouseleave="onCardMouseLeave">
        <img v-if="avatarUrl" :src="avatarUrl" class="user-avatar user-avatar-img" alt="" />
        <div v-else class="user-avatar">{{ getInitial(username) }}</div>
        <div class="user-meta">
          <span class="user-name">{{ displayName }}</span>
          <span class="user-role" :class="ctx.role">{{ ctx.role }}</span>
        </div>
        <GlassButton variant="default" class="icon-btn" :title="t('lock.lockScreen')" @click="lock">
          <SvgIcon name="lock" :size="18" />
        </GlassButton>
        <GlassButton variant="danger" class="icon-btn" :title="t('settings.logout')" @click="requestLogout">
          <SvgIcon name="log-out" :size="18" />
        </GlassButton>
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
    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" @done="hideToast" />
  </div>
</template>

<style scoped>@import './styles.css';</style>
