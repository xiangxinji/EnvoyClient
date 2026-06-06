<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useUserProfile } from "../../composables/useUserProfile";
import { getTeamClientInstance } from "../../composables/teamClientContext";
import { TaskService } from "../../services/TaskService";
import SvgIcon from "../SvgIcon";
import BackButton from "../BackButton";

const { t } = useI18n();
const { getDisplayName, getAvatarUrl, getInitial, loadProfiles, getProfile } = useUserProfile();
const ctx = getTeamClientInstance()!;
const taskService = new TaskService(() => ({ myId: ctx.myId, teamName: ctx.teamName }));

const props = defineProps<{ username: string }>();
const emit = defineEmits<{
  back: [];
  chat: [memberId: string];
}>();

const member = computed(() => ctx.members.value.find((m) => m.id === props.username));
const profile = computed(() => getProfile(props.username));
const displayName = computed(() => getDisplayName(props.username));
const avatarSrc = computed(() => getAvatarUrl(props.username));
const initial = computed(() => getInitial(displayName.value));
const role = computed(() => member.value?.role);
const status = computed(() => member.value?.status);
const responsibilities = computed(() => member.value?.responsibilities || profile.value?.responsibilities);
const capabilities = computed(() => member.value?.capabilities || profile.value?.capabilities);

interface TaskStats {
  pending: number;
  running: number;
  reviewing: number;
  completed: number;
  failed: number;
}

const taskStats = ref<TaskStats>({ pending: 0, running: 0, reviewing: 0, completed: 0, failed: 0 });
const statsLoading = ref(false);

async function loadTaskStats() {
  statsLoading.value = true;
  try {
    const data = await taskService.getTaskStats(props.username);
    taskStats.value = { pending: data.pending ?? 0, running: data.running ?? 0, reviewing: data.reviewing ?? 0, completed: data.completed ?? 0, failed: data.failed ?? 0 };
  } catch (e) {
    console.error("[MemberProfilePanel] loadTaskStats failed:", e);
    taskStats.value = { pending: 0, running: 0, reviewing: 0, completed: 0, failed: 0 };
  } finally {
    statsLoading.value = false;
  }
}

watch(
  () => props.username,
  async (name) => {
    if (name) {
      await loadProfiles([name]);
      await loadTaskStats();
    }
  },
  { immediate: true },
);

function handleChat() {
  emit("chat", props.username);
}
</script>

<template>
  <div class="profile-panel">
    <div class="profile-header-bar">
      <span class="profile-header-title">{{ t('profile.title') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="profile-content">
      <div class="profile-avatar-section">
        <div class="profile-avatar">
          <img v-if="avatarSrc" :src="avatarSrc" class="profile-avatar-img" />
          <template v-else>{{ initial }}</template>
        </div>
        <span class="profile-name">{{ displayName }}</span>
        <div class="profile-badges">
          <span v-if="role" class="profile-role" :class="role">{{ role }}</span>
          <span v-if="status" class="profile-status">
            <span class="status-dot" :class="status"></span>
            {{ status === 'online' ? t('profile.online') : t('profile.offline') }}
          </span>
        </div>
      </div>

      <div class="profile-section">
        <h4 class="section-title">{{ t('profile.taskStats') }}</h4>
        <div v-if="statsLoading" class="stats-loading"><span class="spinner-small"></span></div>
        <div v-else class="stats-grid">
          <div class="stat-item">
            <span class="stat-value running">{{ taskStats.running }}</span>
            <span class="stat-label">{{ t('profile.statsRunning') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value pending">{{ taskStats.pending }}</span>
            <span class="stat-label">{{ t('profile.statsPending') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value completed">{{ taskStats.completed }}</span>
            <span class="stat-label">{{ t('profile.statsCompleted') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value failed">{{ taskStats.failed }}</span>
            <span class="stat-label">{{ t('profile.statsFailed') }}</span>
          </div>
        </div>
      </div>

      <div v-if="responsibilities" class="profile-section">
        <h4 class="section-title">{{ t('task.dispatch.responsibilities') }}</h4>
        <p class="section-text">{{ responsibilities }}</p>
      </div>

      <div v-if="capabilities" class="profile-section">
        <h4 class="section-title">{{ t('task.dispatch.capabilities') }}</h4>
        <p class="section-text">{{ capabilities }}</p>
      </div>

      <button class="btn-chat" @click="handleChat">
        <SvgIcon name="chat" :size="16" />
        {{ t('profile.sendMessage') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
