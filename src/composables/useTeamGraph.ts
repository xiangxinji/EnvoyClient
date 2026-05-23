import { ref, computed, onMounted, onUnmounted } from "vue";
import { getTeamClientInstance } from "./teamClientContext";
import { managerFetch } from "../api";
import { apiTaskToTaskMessage, type ApiTask } from "../utils/taskFormatters";
import type { TaskMessage } from "../types";
import type { Task } from "../../envoy/packages/core/task.js";
import type { Node, Edge } from "@vue-flow/core";
import dagre from "@dagrejs/dagre";

export interface TaskSummary {
  running: number;
  pending: number;
  reviewing: number;
  completed: number;
  failed: number;
}

export interface LeaderNodeData {
  label: string;
  id: string;
  isLeader: true;
  taskSummary: TaskSummary;
}

export interface MemberNodeData {
  label: string;
  id: string;
  isLeader: false;
  online: boolean;
  taskSummary: TaskSummary;
  responsibilities: string;
  avatarUrl: string | null;
  nickname: string | null;
}

export type OrgNodeData = LeaderNodeData | MemberNodeData;

function emptySummary(): TaskSummary {
  return { running: 0, pending: 0, reviewing: 0, completed: 0, failed: 0 };
}

export function useTeamGraph() {
  const ctx = getTeamClientInstance()!;
  const { members, myId, role, teamName, client } = ctx;

  const tasks = ref<TaskMessage[]>([]);
  let loading = false;

  async function fetchTasks() {
    if (loading) return;
    loading = true;
    try {
      const res = await managerFetch(`/api/teams/${encodeURIComponent(teamName)}/tasks`);
      const data = await res.json() as ApiTask[];
      tasks.value = data.map(apiTaskToTaskMessage);
    } catch {
      // server unreachable, keep existing data
    } finally {
      loading = false;
    }
  }

  function onTaskUpdate(task: Task) {
    const taskMsg = apiTaskToTaskMessage({
      id: task.id,
      createBy: task.createBy,
      subscribe: task.subscribe,
      content: task.content,
      mode: task.mode,
      status: task.status,
      resources: task.resources,
      createdAt: task.createdAt,
      attempt: task.attempt,
    });

    const idx = tasks.value.findIndex((t) => t.taskId === task.id);
    if (idx >= 0) {
      tasks.value[idx] = taskMsg;
    } else {
      tasks.value.unshift(taskMsg);
    }
    tasks.value = [...tasks.value];
  }

  function computeTaskSummary(memberId: string, isLeader: boolean): TaskSummary {
    const summary = emptySummary();
    const relevantTasks = isLeader
      ? tasks.value.filter((t) => t.from === memberId)
      : tasks.value.filter((t) => t.subscribe?.includes(memberId));

    for (const task of relevantTasks) {
      const key = task.status as keyof TaskSummary;
      if (key in summary) {
        summary[key]++;
      }
    }
    return summary;
  }

  function activeTaskCount(summary: TaskSummary): number {
    return summary.running + summary.pending + summary.reviewing;
  }

  function buildSummaryMap(): Map<string, TaskSummary> {
    const map = new Map<string, TaskSummary>();
    map.set(myId, computeTaskSummary(myId, role === "leader"));
    for (const m of members.value) {
      map.set(m.id, computeTaskSummary(m.id, false));
    }
    return map;
  }

  const graphData = computed(() => {
    const nodes: Node<OrgNodeData>[] = [];
    const edges: Edge[] = [];
    const summaryMap = buildSummaryMap();

    // Leader node
    nodes.push({
      id: `leader-${myId}`,
      type: "leader",
      position: { x: 0, y: 0 },
      data: {
        label: myId,
        id: myId,
        isLeader: true,
        taskSummary: summaryMap.get(myId) ?? emptySummary(),
      },
    });

    // Sort members: online first, then by active task count descending
    const sortedMembers = [...members.value].sort((a, b) => {
      const aOnline = a.status === "online" ? 1 : 0;
      const bOnline = b.status === "online" ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;

      const aSummary = summaryMap.get(a.id) ?? emptySummary();
      const bSummary = summaryMap.get(b.id) ?? emptySummary();
      return activeTaskCount(bSummary) - activeTaskCount(aSummary);
    });

    for (const m of sortedMembers) {
      const memberSummary = summaryMap.get(m.id) ?? emptySummary();
      const nodeId = `member-${m.id}`;
      const isOnline = m.status === "online";

      nodes.push({
        id: nodeId,
        type: "member",
        position: { x: 0, y: 0 },
        data: {
          label: m.id,
          id: m.id,
          isLeader: false,
          online: isOnline,
          taskSummary: memberSummary,
          responsibilities: m.responsibilities ?? "",
          avatarUrl: m.avatar_url ?? null,
          nickname: m.nickname ?? null,
        },
      });

      edges.push({
        id: `edge-leader-${nodeId}`,
        source: `leader-${myId}`,
        target: nodeId,
        style: isOnline
          ? { stroke: "var(--text-secondary)", strokeWidth: 1.5 }
          : { stroke: "var(--text-muted)", strokeWidth: 1, opacity: 0.4 },
        type: "smoothstep",
        animated: false,
      });
    }

    // Apply dagre layout
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", ranksep: 120, nodesep: 40, marginx: 40, marginy: 40 });

    for (const node of nodes) {
      const isLeaderNode = node.type === "leader";
      g.setNode(node.id, {
        width: isLeaderNode ? 200 : 180,
        height: isLeaderNode ? 100 : 90,
      });
    }
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    for (const node of nodes) {
      const pos = g.node(node.id);
      if (pos) {
        node.position = { x: pos.x, y: pos.y };
      }
    }

    return { nodes, edges };
  });

  let refreshTimer: ReturnType<typeof setInterval> | undefined;

  onMounted(async () => {
    await fetchTasks();
    client?.on("task", onTaskUpdate);
    refreshTimer = setInterval(fetchTasks, 30000);
  });

  onUnmounted(() => {
    client?.off("task", onTaskUpdate);
    if (refreshTimer) clearInterval(refreshTimer);
  });

  return { graphData, fetchTasks };
}
