import { ref, computed, type Ref, type ComputedRef } from "vue";
import type { MemberInfo } from "../types";

export interface ToolEntry {
  id: string;
  label: string;
}

export interface SidebarSearchResult {
  searchQuery: Ref<string>;
  filteredTools: ComputedRef<ToolEntry[]>;
  filteredMembers: ComputedRef<MemberInfo[]>;
  matchHints: ComputedRef<Map<string, string>>;
  filteredNavItems: ComputedRef<string[]>;
  isEmpty: ComputedRef<boolean>;
}

export function useSidebarSearch(
  members: Ref<MemberInfo[]>,
  role: "leader" | "member",
  t: (key: string, params?: Record<string, unknown>) => string,
): SidebarSearchResult {
  const searchQuery = ref("");

  const allTools = computed<ToolEntry[]>(() => {
    const tools: ToolEntry[] = [
      { id: "__cloud__", label: t("sidebar.cloudResources") },
      { id: "__tasks__", label: t("sidebar.taskCenter") },
    ];
    if (role === "leader") {
      tools.push({ id: "__dispatch__", label: t("sidebar.taskDispatch") });
    }
    return tools;
  });

  const query = computed(() => searchQuery.value.trim().toLowerCase());

  const filteredTools = computed(() => {
    if (!query.value) return allTools.value;
    return allTools.value.filter((tool) =>
      tool.label.toLowerCase().includes(query.value),
    );
  });

  const filteredMembers = computed(() => {
    if (!query.value) return members.value;
    return members.value.filter((m) => {
      const fields = [m.id, m.responsibilities, m.capabilities].filter(
        Boolean,
      ) as string[];
      return fields.some((f) => f.toLowerCase().includes(query.value));
    });
  });

  const matchHints = computed(() => {
    const hints = new Map<string, string>();
    if (!query.value) return hints;

    for (const m of filteredMembers.value) {
      const nameMatch = m.id.toLowerCase().includes(query.value);
      if (nameMatch) continue;

      const respMatch =
        m.responsibilities &&
        m.responsibilities.toLowerCase().includes(query.value);
      const capMatch =
        m.capabilities &&
        m.capabilities.toLowerCase().includes(query.value);

      if (respMatch && !capMatch) {
        hints.set(m.id, `${t("task.dispatch.responsibilities", { text: m.responsibilities })}`);
      } else if (capMatch && !respMatch) {
        hints.set(m.id, `${t("task.dispatch.capabilities", { text: m.capabilities })}`);
      } else if (respMatch && capMatch) {
        hints.set(m.id, `${t("task.dispatch.responsibilities", { text: m.responsibilities })}; ${t("task.dispatch.capabilities", { text: m.capabilities })}`);
      }
    }
    return hints;
  });

  const isEmpty = computed(() => {
    if (!query.value) return false;
    return filteredTools.value.length === 0 && filteredMembers.value.length === 0;
  });

  const filteredNavItems = computed(() => {
    const items: string[] = [];
    for (const tool of filteredTools.value) {
      items.push(tool.id);
    }
    for (const m of filteredMembers.value) {
      items.push(m.id);
    }
    return items;
  });

  return {
    searchQuery,
    filteredTools,
    filteredMembers,
    matchHints,
    filteredNavItems,
    isEmpty,
  };
}
