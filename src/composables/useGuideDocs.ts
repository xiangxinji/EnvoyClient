import { ref, computed, watch, onMounted, onUnmounted, type Ref, type ComputedRef } from "vue";
import { Marked, type Tokens } from "marked";
import DOMPurify from "dompurify";
import { i18n } from "../i18n";

// ── Types ──────────────────────────────────────────────────────────

export interface GuideHeading {
  id: string;
  text: string;
  level: number;
}

export interface GuideModule {
  id: string;
  title: string;
  headings: GuideHeading[];
  htmlContent: string;
  plainText: string;
}

export interface SearchResult {
  moduleId: string;
  moduleTitle: string;
  headingId: string;
  headingText: string;
  snippet: string;
}

// ── Module order ───────────────────────────────────────────────────

const MODULE_ORDER = [
  "chat",
  "cloud",
  "task-center",
  "task-dispatch",
  "agent-execution",
  "execution-monitoring",
  "ai-assistant",
  "knowledge-base",
  "keyboard-shortcuts",
  "settings",
];

// ── Load all markdown files at build time ──────────────────────────

const docsRaw = import.meta.glob<string>("../docs/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

// ── Helpers ────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function parseModule(
  moduleId: string,
  rawMarkdown: string,
): { module: GuideModule; results: SearchResult[] } {
  let headingIdx = 0;
  const headings: GuideHeading[] = [];

  // Custom renderer to inject heading IDs
  const renderer = {
    heading({ text, depth }: Tokens.Heading) {
      const id = `guide-${moduleId}-${headingIdx++}`;
      headings.push({ id, text, level: depth });
      return `<h${depth} id="${id}">${text}</h${depth}>`;
    },
  };

  // Use a separate marked instance to avoid polluting global config
  const instance = new Marked({ gfm: true, breaks: true });
  instance.use({ renderer });

  const html = DOMPurify.sanitize(instance.parse(rawMarkdown) as string, {
    ADD_ATTR: ["id"],
  });

  const plainText = stripHtml(html);
  const title = headings.find((h) => h.level === 1)?.text ?? moduleId;

  const results: SearchResult[] = headings
    .filter((h) => h.level === 2)
    .map((h) => ({
      moduleId,
      moduleTitle: title,
      headingId: h.id,
      headingText: h.text,
      snippet: plainText.slice(
        Math.max(0, plainText.indexOf(h.text) - 0),
        Math.min(plainText.length, plainText.indexOf(h.text) + 80),
      ),
    }));

  return {
    module: { id: moduleId, title, headings, htmlContent: html, plainText },
    results,
  };
}

function buildModules(locale: string): {
  modules: GuideModule[];
  allResults: SearchResult[];
} {
  // locale "en" maps to folder "en", "zh-CN" maps to folder "zh-CN"
  const modules: GuideModule[] = [];
  const allResults: SearchResult[] = [];

  for (const modId of MODULE_ORDER) {
    const path = `../docs/${locale}/${modId}.md`;
    const raw = docsRaw[path];
    if (!raw) continue;
    const parsed = parseModule(modId, raw);
    modules.push(parsed.module);
    allResults.push(...parsed.results);
  }

  return { modules, allResults };
}

// ── Composable ─────────────────────────────────────────────────────

export function useGuideDocs(contentRef: Ref<HTMLElement | null>) {
  const searchQuery = ref("");
  const activeHeadingId = ref<string | null>(null);
  let observer: IntersectionObserver | null = null;

  // Rebuild modules when locale changes
  const currentLocale = computed(() => i18n.global.locale.value as string);

  const parsed = computed(() => buildModules(currentLocale.value));

  const modules: ComputedRef<GuideModule[]> = computed(() => parsed.value.modules);

  // Search logic
  const query = computed(() => searchQuery.value.trim().toLowerCase());
  const isSearching = computed(() => query.value.length > 0);

  const searchResults = computed<SearchResult[]>(() => {
    if (!query.value) return [];
    return parsed.value.allResults.filter(
      (r) =>
        r.headingText.toLowerCase().includes(query.value) ||
        r.moduleTitle.toLowerCase().includes(query.value) ||
        r.snippet.toLowerCase().includes(query.value),
    );
  });

  // When searching, filter modules to only those with matching results
  const displayModules = computed<GuideModule[]>(() => {
    if (!isSearching.value) return modules.value;
    const matchedIds = new Set(searchResults.value.map((r) => r.moduleId));
    return modules.value.filter((m) => matchedIds.has(m.id));
  });

  // Scroll to heading
  function scrollToHeading(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // IntersectionObserver for scroll-based TOC tracking
  function setupObserver() {
    if (observer) observer.disconnect();
    if (!contentRef.value) return;

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target.id.startsWith("guide-")) {
            activeHeadingId.value = entry.target.id;
          }
        }
      },
      {
        root: contentRef.value,
        rootMargin: "-10% 0px -80% 0px",
        threshold: 0,
      },
    );

    // Observe all h2 headings inside content area
    const headings = contentRef.value.querySelectorAll("h2[id^='guide-']");
    headings.forEach((h) => observer!.observe(h));
  }

  // Re-observe when modules or locale change
  watch([modules, contentRef], () => {
    // Use nextTick to ensure DOM is updated
    setTimeout(setupObserver, 50);
  });

  onMounted(() => {
    setupObserver();
  });

  onUnmounted(() => {
    observer?.disconnect();
  });

  return {
    modules,
    searchQuery,
    searchResults,
    isSearching,
    displayModules,
    activeHeadingId,
    scrollToHeading,
  };
}
