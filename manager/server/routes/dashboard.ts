import type { Hono } from "hono";
import { Team } from "../../../envoy/packages/teams/team.js";
import { loadRegistry } from "../team-registry.js";
import { teamStats } from "./teams.js";

export default function dashboardRoutes(app: Hono, teams: Map<string, Team>) {
  app.get("/api/dashboard", async (c) => {
    const records = await loadRegistry();
    let totalOnline = 0;
    let totalTasks = 0;
    const taskSummary = { pending: 0, running: 0, completed: 0, failed: 0 };
    const allTasks: Array<{
      id: string;
      team: string;
      content: string;
      status: string;
      createBy: string;
      assignedTo: string | null;
      result: unknown;
      resources: Array<{ type: string; by: string; data: unknown }>;
      createdAt: number;
    }> = [];

    for (const rec of records) {
      const instance = teams.get(rec.name);
      if (!instance) continue;
      const stats = teamStats(instance);
      totalOnline += stats.onlineClients;
      totalTasks += stats.totalTasks;
      taskSummary.pending += stats.tasksByStatus.pending;
      taskSummary.running += stats.tasksByStatus.running;
      taskSummary.completed += stats.tasksByStatus.completed;
      taskSummary.failed += stats.tasksByStatus.failed;

      for (const t of instance.innerServer.getAllTasks()) {
        const clientResult = t.resources.find((r) => r.type === "client-result");
        allTasks.push({
          id: t.id,
          team: rec.name,
          content: t.content,
          status: t.status,
          createBy: t.createBy,
          assignedTo: clientResult?.by ?? null,
          result: clientResult?.data ?? null,
          resources: t.resources,
          createdAt: t.createdAt,
        });
      }
    }

    allTasks.sort((a, b) => b.createdAt - a.createdAt);
    const recentTasks = allTasks.slice(0, 20);

    return c.json({ totalTeams: records.length, totalOnline, totalTasks, taskSummary, recentTasks });
  });
}
