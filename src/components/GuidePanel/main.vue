<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import BackButton from "../BackButton";
import GlassInput from "../GlassInput";
import SvgIcon from "../SvgIcon";
import { useGuideDocs } from "../../composables/useGuideDocs";

const { t } = useI18n();

const emit = defineEmits<{
  back: [];
}>();

const contentRef = ref<HTMLElement | null>(null);
const {
  searchQuery,
  searchResults,
  isSearching,
  displayModules,
  activeHeadingId,
  scrollToHeading,
} = useGuideDocs(contentRef);

// Group search results by module for display
const groupedResults = computed(() => {
  if (!isSearching.value) return [];
  const map = new Map<string, typeof searchResults.value>();
  for (const r of searchResults.value) {
    if (!map.has(r.moduleId)) map.set(r.moduleId, []);
    map.get(r.moduleId)!.push(r);
  }
  return Array.from(map.entries());
});

// Clear search and scroll to heading when clicking a search result
function handleResultClick(headingId: string) {
  searchQuery.value = "";
  nextTick(() => scrollToHeading(headingId));
}

// When search is cleared, re-render content — ensure contentRef updates
watch(searchQuery, () => {
  nextTick(() => {
    if (contentRef.value) {
      // Re-trigger observer setup by scrolling to top
      contentRef.value.scrollTop = 0;
    }
  });
});
</script>

<template>
  <div class="guide-panel">
    <!-- Header -->
    <div class="guide-header">
      <span class="header-title">{{ t('guide.title') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <!-- Search bar -->
    <div class="guide-search">
      <GlassInput v-model="searchQuery" :placeholder="t('guide.searchPlaceholder')" clearable>
        <template #prefix>
          <SvgIcon name="search" :size="14" />
        </template>
      </GlassInput>
    </div>

    <!-- Body: TOC sidebar + content area -->
    <div class="guide-body">
      <!-- Left TOC sidebar -->
      <nav class="guide-toc">
        <template v-if="isSearching">
          <template v-for="[modId, results] in groupedResults" :key="modId">
            <div class="toc-module">{{ results[0]?.moduleTitle }}</div>
            <a
              v-for="r in results"
              :key="r.headingId"
              class="toc-item"
              @click.prevent="handleResultClick(r.headingId)"
            >
              {{ r.headingText }}
            </a>
          </template>
          <div v-if="searchResults.length === 0" class="toc-empty">
            {{ t('guide.noResults') }}
          </div>
        </template>
        <template v-else>
          <template v-for="mod in displayModules" :key="mod.id">
            <div class="toc-module">{{ mod.title }}</div>
            <a
              v-for="h in mod.headings.filter(h => h.level === 2)"
              :key="h.id"
              class="toc-item"
              :class="{ active: activeHeadingId === h.id }"
              @click.prevent="scrollToHeading(h.id)"
            >
              {{ h.text }}
            </a>
          </template>
        </template>
      </nav>

      <!-- Right content area -->
      <div class="guide-content" ref="contentRef">
        <template v-if="isSearching && searchResults.length === 0">
          <div class="guide-empty">{{ t('guide.noResults') }}</div>
        </template>
        <template v-else>
          <div
            v-for="mod in displayModules"
            :key="mod.id"
            class="guide-section"
          >
            <div class="markdown-body" v-html="mod.htmlContent" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
