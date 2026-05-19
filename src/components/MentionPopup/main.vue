<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import type { MemberInfo } from "../../types";
import { useUserProfile } from "../../composables/useUserProfile";

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

const { getDisplayName, getAvatarUrl } = useUserProfile();

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
      options.push({ id: m.id, label: getDisplayName(m.id) });
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
      <img v-else-if="getAvatarUrl(opt.id)" :src="getAvatarUrl(opt.id)!" class="mention-avatar-img" />
      <span v-else class="mention-avatar">{{ opt.label.charAt(0).toUpperCase() }}</span>
      <span class="mention-label">{{ opt.id === 'all' ? 'all' : opt.label }}</span>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
