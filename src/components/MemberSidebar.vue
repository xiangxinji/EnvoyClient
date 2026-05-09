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
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  background: #f7f7f7;
}

h3 {
  margin: 0;
  padding: 12px 16px;
  border-bottom: 1px solid #ddd;
  font-size: 0.95em;
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
  transition: background 0.15s;
}

li:hover {
  background: #e8e8e8;
}

li.active {
  background: #d0e0f0;
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
  background: #ffd700;
  color: #333;
}

.member-role.member {
  background: #ddd;
  color: #555;
}

.badge {
  background: #e53e3e;
  color: white;
  font-size: 0.7em;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.empty {
  color: #999;
  cursor: default;
  font-size: 0.9em;
}
</style>
