import type { Hono } from "hono";
import type { Team } from "../../../envoy/packages/teams/team.js";
import { mkdir, writeFile, readdir, readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { getResourcesDir, getTaskDir } from "../team-registry.js";

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

  app.post("/api/tasks/:id/result", async (c) => {
    const teamName = c.req.header("team");
    if (!teamName) return c.json({ error: "team header is required" }, 400);

    const team = teams.get(teamName);
    if (!team) return c.json({ error: "team not found" }, 404);

    const taskId = c.req.param("id");
    const body = await c.req.json<{
      from?: string;
      success?: boolean;
      data?: unknown;
      error?: string;
    }>();
    if (!body.from || body.success === undefined) {
      return c.json({ error: "from, success are required" }, 400);
    }

    team.innerServer.receiveResult(body.from, taskId, body.success, body.data, body.error);

    // Persist result to disk
    try {
      const resDir = getResourcesDir(teamName, taskId);
      await mkdir(resDir, { recursive: true });
      await writeFile(
        join(resDir, `${body.from}.json`),
        JSON.stringify({ success: body.success, data: body.data, error: body.error, timestamp: Date.now() }, null, 2),
        "utf-8"
      );
    } catch (e) {
      console.error(`[persist] failed to write result for task ${taskId}:`, e);
    }

    return c.json({ ok: true });
  });

  app.post("/api/tasks/:id/resources", async (c) => {
    const teamName = c.req.header("team");
    if (!teamName) return c.json({ error: "team header is required" }, 400);

    const team = teams.get(teamName);
    if (!team) return c.json({ error: "team not found" }, 404);

    const taskId = c.req.param("id");
    const resDir = getResourcesDir(teamName, taskId);
    await mkdir(resDir, { recursive: true });

    const formData = await c.req.formData();
    const file = formData.get("file");
    const from = formData.get("from") as string | null;

    if (!file || !(file instanceof File)) {
      return c.json({ error: "file is required" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = join(resDir, file.name);
    await writeFile(filePath, buffer);

    const relativePath = `resources/${file.name}`;
    return c.json({ ok: true, path: relativePath });
  });

  // List resources for a task
  app.get("/api/tasks/:id/resources", async (c) => {
    const teamName = c.req.header("team");
    if (!teamName) return c.json({ error: "team header is required" }, 400);

    const team = teams.get(teamName);
    if (!team) return c.json({ error: "team not found" }, 404);

    const taskId = c.req.param("id");
    const resDir = getResourcesDir(teamName, taskId);

    try {
      const entries = await readdir(resDir, { withFileTypes: true });
      const files = await Promise.all(
        entries
          .filter((e) => e.isFile())
          .map(async (e) => {
            const fullPath = join(resDir, e.name);
            const s = await stat(fullPath);
            return {
              filename: e.name,
              size: s.size,
              uploadedAt: s.mtimeMs,
              path: `resources/${e.name}`,
            };
          })
      );
      return c.json({ files });
    } catch {
      return c.json({ files: [] });
    }
  });

  // Download a specific resource file
  app.get("/api/tasks/:id/resources/:file", async (c) => {
    const teamName = c.req.header("team");
    if (!teamName) return c.json({ error: "team header is required" }, 400);

    const team = teams.get(teamName);
    if (!team) return c.json({ error: "team not found" }, 404);

    const taskId = c.req.param("id");
    const filename = basename(c.req.param("file"));
    const filePath = join(getResourcesDir(teamName, taskId), filename);

    try {
      const data = await readFile(filePath);
      return new Response(data, {
        headers: {
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Type": "application/octet-stream",
        },
      });
    } catch {
      return c.json({ error: "file not found" }, 404);
    }
  });
}
