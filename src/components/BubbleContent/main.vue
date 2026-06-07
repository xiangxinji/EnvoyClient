<script setup lang="ts">
import { renderMarkdown, escapeRegex, DOMPurify } from "../../utils/markdown";
import { useUserProfile } from "../../composables/useUserProfile";
import { useFullscreenViewer } from "../../composables/useFullscreenViewer";
import { computed } from "vue";

const { getDisplayName } = useUserProfile();
const viewer = useFullscreenViewer();

const props = defineProps<{
  text: string;
  mentions?: string[];
  memberIds?: string[];
  showSender?: boolean;
  senderName?: string;
}>();

const renderedHtml = computed(() => {
  let text = props.text.replace(/\{cloud:\d+\}/g, "");
  if (props.mentions && props.mentions.length > 0) {
    const expanded = props.mentions.flatMap(m =>
      m === "all" && props.memberIds ? props.memberIds : [m]
    );
    for (const m of expanded) {
      const displayName = getDisplayName(m);
      text = text.replace(new RegExp(`@${escapeRegex(m)}(?!\\w)`, "g"), `<span class="mention-highlight">@${escapeRegex(displayName)}</span>`);
    }
  }
  return DOMPurify.sanitize(renderMarkdown(text), {
    ADD_TAGS: ["span", "a", "img"],
    ADD_ATTR: ["class", "target", "rel", "href", "src", "alt", "title", "loading"],
  });
});

function onContentClick(e: MouseEvent) {
  const img = (e.target as HTMLElement).closest("img") as HTMLImageElement | null;
  if (!img?.src) return;
  e.preventDefault();
  e.stopPropagation();
  viewer.openFullscreen(img.src);
}
</script>

<template>
  <template v-if="showSender">
    <span class="sender-name">{{ senderName }}</span>
  </template>
  <div class="content" v-html="renderedHtml" @click="onContentClick"></div>
</template>

<style scoped>
@import './styles.css';
</style>
