import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Team } from "../../Envoy/packages/teams/team.js";
import {
  loadRegistry,
  saveRegistry,
  allocatePort,
  ensureRegistryDir,
  type TeamRecord,
} from "./team-registry.js";

const app = new Hono();
const teamInstances = new Map<string, Team>();

async function restoreTeams(): Promise<void> {
  const records = await loadRegistry();
  for (const rec of records) {
    const team = new Team({ port: rec.port, host: "0.0.0.0" });
    await team.start();
    teamInstances.set(rec.name, team);
    console.log(`[restored] team "${rec.name}" on port ${rec.port}`);
  }
}

function getTeamStats(team: Team) {
  const server = team.innerServer;
  const clients = server.getClients();
  const onlineClients = server.getOnlineClients();
  const tasks = server.getAllTasks();
  return {
    totalClients: clients.length,
    onlineClients: onlineClients.length,
    totalTasks: tasks.length,
    tasksByStatus: {
      pending: tasks.filter((t) => t.status === "pending").length,
      running: tasks.filter((t) => t.status === "running").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
    },
  };
}

// --- Routes ---

app.post("/api/teams", async (c) => {
  const body = await c.req.json<{ name?: string; port?: number }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: "name is required" }, 400);
  if (teamInstances.has(name)) return c.json({ error: "team already exists" }, 409);

  const records = await loadRegistry();
  const port = body.port ?? allocatePort(records);
  const record: TeamRecord = { name, port, createdAt: Date.now() };

  const team = new Team({ port, host: "0.0.0.0" });
  await team.start();
  teamInstances.set(name, team);

  records.push(record);
  await saveRegistry(records);

  console.log(`[created] team "${name}" on port ${port}`);
  return c.json({ name, port, createdAt: record.createdAt }, 201);
});

app.get("/api/teams", async (c) => {
  const records = await loadRegistry();
  const teams = records.map((rec) => {
    const instance = teamInstances.get(rec.name);
    return {
      ...rec,
      status: instance ? "running" : "stopped",
      stats: instance ? getTeamStats(instance) : null,
    };
  });
  return c.json(teams);
});

app.get("/api/teams/:name", async (c) => {
  const name = c.req.param("name");
  const instance = teamInstances.get(name);
  if (!instance) return c.json({ error: "team not found" }, 404);

  const records = await loadRegistry();
  const record = records.find((r) => r.name === name);
  return c.json({
    name,
    port: record?.port,
    createdAt: record?.createdAt,
    status: "running",
    stats: getTeamStats(instance),
  });
});

app.delete("/api/teams/:name", async (c) => {
  const name = c.req.param("name");
  const instance = teamInstances.get(name);
  if (!instance) return c.json({ error: "team not found" }, 404);

  await instance.stop();
  teamInstances.delete(name);

  let records = await loadRegistry();
  records = records.filter((r) => r.name !== name);
  await saveRegistry(records);

  console.log(`[deleted] team "${name}"`);
  return c.json({ ok: true });
});

app.get("/api/teams/:name/members", async (c) => {
  const name = c.req.param("name");
  const instance = teamInstances.get(name);
  if (!instance) return c.json({ error: "team not found" }, 404);

  const server = instance.innerServer;
  const clients = server.getClients();
  return c.json(clients);
});

app.get("/api/teams/:name/tasks", async (c) => {
  const name = c.req.param("name");
  const instance = teamInstances.get(name);
  if (!instance) return c.json({ error: "team not found" }, 404);

  const tasks = instance.innerServer.getAllTasks();
  return c.json(tasks);
});

// --- Dashboard ---

app.get("/api/dashboard", async (c) => {
  const records = await loadRegistry();
  let totalOnline = 0;
  let totalTasks = 0;
  const taskSummary = { pending: 0, running: 0, completed: 0, failed: 0 };

  for (const rec of records) {
    const instance = teamInstances.get(rec.name);
    if (!instance) continue;
    const stats = getTeamStats(instance);
    totalOnline += stats.onlineClients;
    totalTasks += stats.totalTasks;
    taskSummary.pending += stats.tasksByStatus.pending;
    taskSummary.running += stats.tasksByStatus.running;
    taskSummary.completed += stats.tasksByStatus.completed;
    taskSummary.failed += stats.tasksByStatus.failed;
  }

  return c.json({
    totalTeams: records.length,
    totalOnline,
    totalTasks,
    taskSummary,
  });
});

// --- Start ---

const PORT = Number(process.env.MANAGER_PORT) || 8080;

await ensureRegistryDir();
await restoreTeams();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Manager API running on http://localhost:${info.port}`);
});
