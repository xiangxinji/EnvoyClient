<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import type { MemberInfo } from "../types";

const props = defineProps<{
  visible: boolean;
  members: MemberInfo[];
  query: string;
  myId: string;
}>();

const emit = defineEmits<{
  select: [memberId: string];
  close: [];
}>();

const listRef = ref<HTMLDivElement | null>(null);
const selectedIndex = ref(0);

const filteredOptions = computed(() => {
  const options: Array<{ id: string; label: string }> = [];
  if (!props.query || "all".startsWith(props.query.toLowerCase())) {
    options.push({ id: "all", label: "all" });
  }
  for (const m of props.members) {
    if (m.id === props.myId) continue;
    if (!props.query || m.id.toLowerCase().includes(props.query.toLowerCase())) {
      options.push({ id: m.id, label: m.id });
    }
  }
  return options;
});

watch(() => props.visible, (v) => {
  if (v) {
    selectedIndex.value = 0;
    nextTick(() => {
      listRef.value?.scrollTo({ top: 0 });
    });
  }
});

watch(filteredOptions, () => {
  if (selectedIndex.value >= filteredOptions.value.length) {
    selectedIndex.value = 0;
  }
});

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible || filteredOptions.value.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % filteredOptions.value.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex.value = selectedIndex.value <= 0 ? filteredOptions.value.length - 1 : selectedIndex.value - 1;
  } else if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    const opt = filteredOptions.value[selectedIndex.value];
    if (opt) emit("select", opt.id);
  } else if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
  }
}

defineExpose({ handleKeydown });
</script>

<template>
  <div v-if="visible && filteredOptions.length > 0" ref="listRef" class="mention-popup">
    <div
      v-for="(opt, idx) in filteredOptions"
      :key="opt.id"
      class="mention-item"
      :class="{ selected: idx === selectedIndex }"
      @click="emit('select', opt.id)"
      @mouseenter="selectedIndex = idx"
    >
      <span v-if="opt.id === 'all'" class="mention-icon">@</span>
      <span v-else class="mention-avatar">{{ opt.label.charAt(0).toUpperCase() }}</span>
      <span class="mention-label">{{ opt.id === 'all' ? 'all' : opt.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.mention-popup {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--glass-shadow);
  max-height: 180px;
  overflow-y: auto;
  min-width: 160px;
  z-index: 10;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px 10px;
  cursor: pointer;
  color: var(--text-primary);
  transition: background 0.1s;
}

.mention-item:hover,
.mention-item.selected {
  background: var(--sidebar-hover);
}

.mention-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65em;
  font-weight: 600;
  flex-shrink: 0;
}

.mention-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  font-weight: 700;
  flex-shrink: 0;
}

.mention-label {
  font-size: 0.82em;
  font-weight: 500;
}
</style>
