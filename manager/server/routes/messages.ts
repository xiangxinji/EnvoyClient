import type { Hono } from "hono";
import type { Team } from "../../../envoy/packages/teams/team.js";

export default function messageRoutes(app: Hono, teams: Map<string, Team>) {
  app.post("/api/messages", async (c) => {
    const teamName = c.req.header("team");
    if (!teamName) return c.json({ error: "team header is required" }, 400);

    const team = teams.get(teamName);
    if (!team) return c.json({ error: "team not found" }, 404);

    const body = await c.req.json<{ from?: string; to?: string; text?: string }>();
    if (!body.from || !body.to || !body.text) {
      return c.json({ error: "from, to, text are required" }, 400);
    }

    team.innerServer.relay(body.from, body.to, "chat", { text: body.text });
    return c.json({ ok: true });
  });

  app.post("/api/tasks", async (c) => {
    const teamName = c.req.header("team");
    if (!teamName) return c.json({ error: "team header is required" }, 400);

    const team = teams.get(teamName);
    if (!team) return c.json({ error: "team not found" }, 404);

    const body = await c.req.json<{
      from?: string;
      content?: string;
      subscribe?: string[];
      mode?: "serial" | "parallel";
    }>();
    if (!body.from || !body.content || !body.subscribe) {
      return c.json({ error: "from, content, subscribe are required" }, 400);
    }

    const taskId = team.innerServer.submitFrom(body.from, {
      content: body.content,
      subscribe: body.subscribe,
      mode: body.mode ?? "serial",
    });
    return c.json({ ok: true, taskId });
  });
}
