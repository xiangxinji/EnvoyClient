import type { Hono } from "hono";
import { Team } from "../../../Envoy/packages/teams/team.js";
import { loadRegistry } from "../team-registry.js";
import { teamStats } from "./teams.js";

export default function dashboardRoutes(app: Hono, teams: Map<string, Team>) {
  app.get("/api/dashboard", async (c) => {
    const records = await loadRegistry();
    let totalOnline = 0;
    let totalTasks = 0;
    const taskSummary = { pending: 0, running: 0, completed: 0, failed: 0 };

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
    }

    return c.json({ totalTeams: records.length, totalOnline, totalTasks, taskSummary });
  });
}
