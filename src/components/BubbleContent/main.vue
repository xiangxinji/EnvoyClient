<script setup lang="ts">
import type { CloudRef } from "../../types";
import { renderMarkdown, escapeRegex, DOMPurify } from "../../utils/markdown";
import { formatFileSize } from "../../utils/taskFormatters";
import { useUserProfile } from "../../composables/useUserProfile";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getCloudResourceService } from "../../composables/teamClientContext";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

const props = defineProps<{
  text: string;
  mentions?: string[];
  memberIds?: string[];
  forwarded?: { from: string; text?: string; timestamp: number }[] | null;
  showSender?: boolean;
  senderName?: string;
  cloudRefs?: CloudRef[];
  teamName?: string;
}>();

const emit = defineEmits<{
  "open-forwarded": [];
}>();

const { getDisplayName } = useUserProfile();

const validationMap = ref<Record<string, boolean>>({});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const renderedHtml = computed(() => {
  let rawText = props.text;

  // Replace {cloud:N} markers with final HTML before markdown processing
  rawText = rawText.replace(/\{cloud:(\d+)\}/g, (_match: string, idx: string) => {
    const index = parseInt(idx, 10);
    const cloudRef = props.cloudRefs?.[index];
    if (!cloudRef || !cloudRef.name) return `{cloud:${index}}`;
    const refPath = cloudRef.path ?? "";
    const expired = refPath ? validationMap.value[refPath] === false : false;
    if (cloudRef.type === "directory") {
      return expired
        ? `<span class="cloud-ref-card expired"><span class="cloud-ref-icon-fallback">📁</span><span class="cloud-ref-name">${escapeHtml(cloudRef.name)}</span><span class="cloud-ref-expired">(${t("cloudMention.expired")})</span></span>`
        : `<span class="cloud-ref-card directory" data-cloud-path="${escapeHtml(refPath)}"><span class="cloud-ref-icon-fallback">📁</span><span class="cloud-ref-name">${escapeHtml(cloudRef.name)}</span><span class="cloud-ref-action">${t("cloudMention.openInCloud")}</span></span>`;
    } else {
      const dlUrl = refPath && props.teamName ? escapeHtml(getCloudResourceService().downloadUrl(refPath)) : "#";
      return expired
        ? `<span class="cloud-ref-card expired"><span class="cloud-ref-icon-fallback">📄</span><span class="cloud-ref-info"><span class="cloud-ref-name">${escapeHtml(cloudRef.name)}</span><span class="cloud-ref-expired">(${t("cloudMention.expired")})</span></span></span>`
        : `<a class="cloud-ref-card file" href="${dlUrl}" target="_blank" rel="noopener"><span class="cloud-ref-icon-fallback">📄</span><span class="cloud-ref-info"><span class="cloud-ref-name">${escapeHtml(cloudRef.name)}</span><span class="cloud-ref-size">${formatFileSize(cloudRef.size ?? 0)}</span></span><span class="cloud-ref-download">⬇</span></a>`;
    }
  });

  if (props.mentions && props.mentions.length > 0) {
    const expanded = props.mentions.flatMap(m =>
      m === "all" && props.memberIds ? props.memberIds : [m]
    );
    for (const m of expanded) {
      const displayName = getDisplayName(m);
      rawText = rawText.replace(new RegExp(`@${escapeRegex(m)}(?!\\w)`, "g"), `<span class="mention-highlight">@${escapeRegex(displayName)}</span>`);
    }
  }
  let raw = renderMarkdown(rawText);
  let sanitized = DOMPurify.sanitize(raw, { ADD_TAGS: ["span", "a"], ADD_ATTR: ["class", "data-cloud-path", "target", "rel", "href"] });

  return sanitized;
});

let cancelled = false;
onMounted(async () => {
  if (!props.cloudRefs?.length || !props.teamName) return;
  const paths = props.cloudRefs.map(r => r.path);
  try {
    const result = await getCloudResourceService().validatePaths(paths);
    if (!cancelled) validationMap.value = result;
  } catch {
    // silent fail — cards stay in valid state
  }
});
onUnmounted(() => { cancelled = true; });
</script>

<template>
  <template v-if="showSender">
    <span class="sender-name">{{ senderName }}</span>
  </template>
  <div v-if="!forwarded?.length" class="content" v-html="renderedHtml"></div>
  <div v-if="forwarded?.length" class="forwarded-summary" @click.stop="emit('open-forwarded')">
    <SvgIcon name="chat" :size="14" />
    <span>Chat History ({{ forwarded.length }})</span>
    <SvgIcon class="arrow" name="chevron-right" :size="12" />
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
