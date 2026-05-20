<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import type { CloudSearchResult } from "../../api";
import { searchCloudFiles } from "../../api";
import { getFileCategory } from "../../utils/fileCategories";
import FileIcon from "../FileIcon";
import SvgIcon from "../SvgIcon";

const props = defineProps<{
  visible: boolean;
  query: string;
  teamName: string;
}>();

const emit = defineEmits<{
  select: [item: CloudSearchResult];
  close: [];
}>();

const { t } = useI18n();

const listRef = ref<HTMLDivElement | null>(null);
const selectedIndex = ref(0);
const results = ref<CloudSearchResult[]>([]);
const loading = ref(false);

async function doSearch(query: string) {
  if (!query) { results.value = []; return; }
  loading.value = true;
  try {
    results.value = await searchCloudFiles(props.teamName, query);
  } catch {
    results.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    selectedIndex.value = 0;
    doSearch(props.query);
    nextTick(() => { listRef.value?.scrollTo({ top: 0 }); });
  } else {
    results.value = [];
  }
});

watch(() => props.query, (q) => {
  if (props.visible) doSearch(q);
});

watch(results, () => {
  if (selectedIndex.value >= results.value.length) selectedIndex.value = 0;
});

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible || (results.value.length === 0 && !loading.value)) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    e.stopPropagation();
    selectedIndex.value = (selectedIndex.value + 1) % results.value.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    e.stopPropagation();
    selectedIndex.value = selectedIndex.value <= 0 ? results.value.length - 1 : selectedIndex.value - 1;
  } else if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    e.stopPropagation();
    const item = results.value[selectedIndex.value];
    if (item) emit("select", item);
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    emit("close");
  }
}

defineExpose({ handleKeydown });
</script>

<template>
  <div v-if="visible && (results.length > 0 || loading || (!loading && query))" ref="listRef" class="cloud-popup">
    <div v-if="loading" class="cloud-popup-loading">
      <span class="spinner-small"></span>
    </div>
    <div v-else-if="results.length === 0 && query" class="cloud-popup-empty">
      {{ t('cloudMention.noResults') }}
    </div>
    <template v-else>
      <div
        v-for="(item, idx) in results"
        :key="item.path"
        class="cloud-item"
        :class="{ selected: idx === selectedIndex }"
        @click="emit('select', item)"
        @mouseenter="selectedIndex = idx"
      >
        <span class="cloud-item-icon">
          <FileIcon :category="getFileCategory(item.name, item.type)" />
        </span>
        <div class="cloud-item-info">
          <span class="cloud-item-name">{{ item.name }}</span>
          <span class="cloud-item-path">{{ item.path }}</span>
        </div>
        <SvgIcon v-if="item.type === 'directory'" name="chevron-right" :size="12" class="cloud-item-arrow" />
      </div>
    </template>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
