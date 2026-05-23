<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useUserProfile } from "../../composables/useUserProfile";
import { apiUrl } from "../../api";
import type { MemberNodeData } from "../../composables/useTeamGraph";

const props = defineProps<{
  data: MemberNodeData;
}>();

const { t } = useI18n();

const userProfile = useUserProfile();
const displayName = computed(() => {
  if (props.data.nickname) return props.data.nickname;
  return userProfile.getDisplayName(props.data.id);
});
const avatarUrl = computed(() => {
  if (props.data.avatarUrl) return apiUrl(props.data.avatarUrl);
  return userProfile.getAvatarUrl(props.data.id);
});
const initial = computed(() => userProfile.getInitial(displayName.value));

const summary = computed(() => {
  if (!props.data.online) return "";
  const s = props.data.taskSummary;
  const parts: string[] = [];
  if (s.running > 0) parts.push(`⏳${s.running}`);
  if (s.completed > 0) parts.push(`✅${s.completed}`);
  if (s.failed > 0) parts.push(`❌${s.failed}`);
  if (s.reviewing > 0) parts.push(`🔍${s.reviewing}`);
  if (s.pending > 0) parts.push(`⏸${s.pending}`);
  return parts.join("  ");
});

const hasTasks = computed(() => {
  const s = props.data.taskSummary;
  return s.running + s.completed + s.failed + s.reviewing + s.pending > 0;
});

const responsibilities = computed(() => {
  const r = props.data.responsibilities;
  if (!r) return "";
  return r.length > 20 ? r.slice(0, 20) + "..." : r;
});
</script>

<template>
  <div class="org-node member-node" :class="{ offline: !data.online }">
    <div class="node-avatar">
      <img v-if="avatarUrl" :src="avatarUrl" class="avatar-img" />
      <template v-else>{{ initial }}</template>
      <span class="status-dot" :class="data.online ? 'online' : 'offline'"></span>
    </div>
    <div class="node-info">
      <span class="node-name">{{ displayName }}</span>
      <template v-if="data.online">
        <span v-if="hasTasks" class="node-summary">{{ summary }}</span>
        <span v-else class="node-idle">✨ {{ t('sidebar.orgIdle') }}</span>
        <span v-if="responsibilities" class="node-resp" :title="data.responsibilities">{{ responsibilities }}</span>
      </template>
      <span v-else class="node-offline-text">{{ t('sidebar.orgOffline') }}</span>
    </div>
  </div>
</template>
