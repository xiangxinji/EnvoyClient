<script setup lang="ts">
import { inject } from "vue";
import { TeamClientKey } from "../composables/teamClientContext";

defineProps<{
  selectedPeer: string;
}>();

const emit = defineEmits<{
  select: [peerId: string];
}>();

const ctx = inject(TeamClientKey)!;
const { members, unreadCounts, syncUnread } = ctx;

function handleClick(peerId: string) {
  syncUnread(peerId, true);
  emit("select", peerId);
}
</script>

<template>
  <aside class="sidebar">
    <h3>Members</h3>
    <ul>
      <li
        v-for="m in members"
        :key="m.id"
        :class="{ active: m.id === selectedPeer }"
        @click="handleClick(m.id)"
      >
        <span class="member-name">{{ m.id }}</span>
        <span class="member-role" :class="m.role">{{ m.role }}</span>
        <span v-if="(unreadCounts.get(m.id) ?? 0) > 0" class="badge">
          {{ unreadCounts.get(m.id) }}
        </span>
      </li>
      <li v-if="members.length === 0" class="empty">
        No members online
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 250px;
  min-width: 250px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

h3 {
  margin: 0;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 0.95em;
  color: var(--text-primary);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  color: var(--text-primary);
}

li:hover {
  background: var(--sidebar-hover);
}

li.active {
  background: var(--sidebar-active);
}

.member-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-role {
  font-size: 0.7em;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
}

.member-role.leader {
  background: var(--role-leader-bg);
  color: var(--role-leader-text);
}

.member-role.member {
  background: var(--role-member-bg);
  color: var(--role-member-text);
}

.badge {
  background: var(--badge-bg);
  color: white;
  font-size: 0.7em;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.empty {
  color: var(--text-muted);
  cursor: default;
  font-size: 0.9em;
}
</style>
