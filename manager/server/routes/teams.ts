import type { Hono } from "hono";
import { Team } from "../../../envoy/packages/teams/team.js";
import {
  loadRegistry,
  saveRegistry,
  allocatePort,
  type TeamRecord,
} from "../team-registry.js";
import { loadUsers } from "../user-registry.js";

export function teamStats(team: Team) {
  const server = team.innerServer;
  const clients = server.getClients();
  const tasks = server.getAllTasks();
  return {
    totalClients: clients.length,
    onlineClients: server.getOnlineClients().length,
    totalTasks: tasks.length,
    tasksByStatus: {
      pending: tasks.filter((t) => t.status === "pending").length,
      running: tasks.filter((t) => t.status === "running").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
    },
  };
}

export default function teamRoutes(app: Hono, teams: Map<string, Team>) {
  app.post("/api/teams", async (c) => {
    const body = await c.req.json<{ name?: string; port?: number }>();
    const name = body.name?.trim();
    if (!name) return c.json({ error: "name is required" }, 400);
    if (teams.has(name)) return c.json({ error: "team already exists" }, 409);

    const records = await loadRegistry();
    const port = body.port ?? allocatePort(records);
    const record: TeamRecord = { name, port, createdAt: Date.now() };

    const team = new Team({ port, host: "0.0.0.0" });
    await team.start();
    teams.set(name, team);

    records.push(record);
    await saveRegistry(records);

    console.log(`[created] team "${name}" on port ${port}`);
    return c.json({ name, port, createdAt: record.createdAt }, 201);
  });

  app.get("/api/teams", async (c) => {
    const records = await loadRegistry();
    return c.json(
      records.map((rec) => {
        const instance = teams.get(rec.name);
        return {
          ...rec,
          status: instance ? "running" : "stopped",
          stats: instance ? teamStats(instance) : null,
        };
      })
    );
  });

  app.get("/api/teams/:name", async (c) => {
    const name = c.req.param("name");
    const instance = teams.get(name);
    if (!instance) return c.json({ error: "team not found" }, 404);

    const records = await loadRegistry();
    const record = records.find((r) => r.name === name);
    return c.json({
      name,
      port: record?.port,
      createdAt: record?.createdAt,
      status: "running",
      stats: teamStats(instance),
    });
  });

  app.delete("/api/teams/:name", async (c) => {
    const name = c.req.param("name");
    const instance = teams.get(name);
    if (!instance) return c.json({ error: "team not found" }, 404);

    await instance.stop();
    teams.delete(name);

    let records = await loadRegistry();
    records = records.filter((r) => r.name !== name);
    await saveRegistry(records);

    console.log(`[deleted] team "${name}"`);
    return c.json({ ok: true });
  });

  app.get("/api/teams/:name/members", async (c) => {
    const instance = teams.get(c.req.param("name"));
    if (!instance) return c.json({ error: "team not found" }, 404);
    const clients = instance.innerServer.getClients();
    const users = await loadUsers();
    const userMap = new Map(users.map((u) => [u.username, u]));
    return c.json(
      clients.map((cl) => ({
        ...cl,
        responsibilities: userMap.get(cl.id)?.responsibilities ?? "",
      }))
    );
  });

  app.get("/api/teams/:name/tasks", async (c) => {
    const instance = teams.get(c.req.param("name"));
    if (!instance) return c.json({ error: "team not found" }, 404);
    const tasks = instance.innerServer.getAllTasks();
    return c.json(
      tasks.map((t) => {
        const clientResult = t.resources.find((r) => r.type === "client-result");
        return {
          ...t,
          assignedTo: clientResult?.by ?? null,
          result: clientResult?.data ?? null,
        };
      })
    );
  });

  app.get("/api/teams/:name/tasks/:id", async (c) => {
    const instance = teams.get(c.req.param("name"));
    if (!instance) return c.json({ error: "team not found" }, 404);
    const task = instance.innerServer.getTask(c.req.param("id"));
    if (!task) return c.json({ error: "task not found" }, 404);
    const clientResults = task.resources.filter((r) => r.type === "client-result");
    return c.json({
      ...task,
      assignedTo: clientResults.map((r) => r.by),
      results: clientResults.map((r) => ({ by: r.by, data: r.data })),
    });
  });
}
