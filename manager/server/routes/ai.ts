import type { Hono, Context, Next } from "hono";
import { validateSession } from "./admin.js";
import { getAIConfig, updateAIConfig } from "../settings.js";
import { createAIRoutes } from "../services/ai/index.js";
import { handleAgentReason } from "../services/ai/agent.js";
import { handleTaskDispatch } from "../services/ai/dispatch.js";
import { handleTaskReview } from "../services/ai/review.js";

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

  // AI generation routes — reads config from manager.json via getAIConfig()
  const router = createAIRoutes({ getConfig: getAIConfig });
  app.route("/api/ai", router);

  // Agent reasoning — public, no auth
  app.post("/api/ai/agent/reason", async (c) => {
    const config = getAIConfig();
    if (!config.apiKey) {
      return c.json({ error: "AI not configured" }, 503);
    }
    return handleAgentReason(c, config);
  });

  // Task dispatch — public, no auth
  app.post("/api/ai/task/dispatch", async (c) => {
    const config = getAIConfig();
    if (!config.apiKey) {
      return c.json({ error: "AI not configured" }, 503);
    }
    return handleTaskDispatch(c, config);
  });

  // Task review — public, no auth
  app.post("/api/ai/task/review", async (c) => {
    const config = getAIConfig();
    if (!config.apiKey) {
      return c.json({ error: "AI not configured" }, 503);
    }
    return handleTaskReview(c, config);
  });

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
