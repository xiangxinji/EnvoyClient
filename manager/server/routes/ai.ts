import type { Hono, Context, Next } from "hono";
import { validateSession } from "./admin.js";
import { getAIConfig, updateAIConfig } from "../settings.js";
import { createAIRoutes } from "../services/ai/index.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";

async function adminAuth(c: Context, next: Next) {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token || !validateSession(token)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
}

export default function aiRoutes(app: Hono) {
  // ─── Public routes (no auth) ───

  // Health check
  app.get("/api/ai/health", (c) => {
    const ai = getAIConfig();
    return c.json({
      configured: ai.apiKey.length > 0,
      provider: ai.provider,
      model: ai.model,
    });
  });

  // AI generation routes — public, API key stays on server
  const TEMP_AI_CONFIG = join(homedir(), ".envoy", ".ai-runtime.json");

  async function syncRuntimeConfig() {
    const ai = getAIConfig();
    await writeFile(TEMP_AI_CONFIG, JSON.stringify(ai), "utf-8");
  }

  const router = createAIRoutes({ configPath: TEMP_AI_CONFIG });

  app.use("/api/ai/chat/*", async (_c, next) => { await syncRuntimeConfig(); await next(); });
  app.use("/api/ai/task/*", async (_c, next) => { await syncRuntimeConfig(); await next(); });
  app.route("/api/ai", router);

  // ─── Admin-only routes (auth required) ───

  app.use("/api/ai/config", adminAuth);

  app.get("/api/ai/config", (c) => {
    const ai = getAIConfig();
    return c.json({
      provider: ai.provider,
      model: ai.model,
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
      configured: ai.apiKey.length > 0,
    });
  });

  app.put("/api/ai/config", async (c) => {
    const body = await c.req.json();
    const updated = await updateAIConfig(body);
    return c.json({
      provider: updated.provider,
      model: updated.model,
      temperature: updated.temperature,
      maxTokens: updated.maxTokens,
      configured: updated.apiKey.length > 0,
    });
  });
}
