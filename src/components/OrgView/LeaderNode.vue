<script setup lang="ts">
import { computed } from "vue";
import { useUserProfile } from "../../composables/useUserProfile";
import type { LeaderNodeData } from "../../composables/useTeamGraph";

const props = defineProps<{
  data: LeaderNodeData;
}>();

const userProfile = useUserProfile();
const displayName = computed(() => userProfile.getDisplayName(props.data.id));
const avatarUrl = computed(() => userProfile.getAvatarUrl(props.data.id));
const initial = computed(() => userProfile.getInitial(displayName.value));

const summary = computed(() => {
  const s = props.data.taskSummary;
  const parts: string[] = [];
  if (s.running > 0) parts.push(`⏳${s.running}`);
  if (s.completed > 0) parts.push(`✅${s.completed}`);
  if (s.failed > 0) parts.push(`❌${s.failed}`);
  if (s.reviewing > 0) parts.push(`🔍${s.reviewing}`);
  if (s.pending > 0) parts.push(`⏸${s.pending}`);
  return parts.join("  ");
});
</script>

<template>
  <div class="org-node leader-node">
    <div class="node-avatar">
      <img v-if="avatarUrl" :src="avatarUrl" class="avatar-img" />
      <template v-else>{{ initial }}</template>
    </div>
    <div class="node-info">
      <span class="node-name">👑 {{ displayName }}</span>
      <span v-if="summary" class="node-summary">{{ summary }}</span>
    </div>
  </div>
</template>
