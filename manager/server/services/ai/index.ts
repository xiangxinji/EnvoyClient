import { Hono } from "hono";
import type { AIConfig, AIConfigPublic, ProviderType } from "../../../../shared/types/ai.js";
import { PROVIDERS } from "./constants.js";
import { toPublicConfig } from "./config.js";
import { handleChatStream, handleChatGenerate } from "./chat.js";
import { handleTaskGenerate } from "./task.js";
import { handleAnalyze } from "./analyze.js";

export interface AIRouterOptions {
  getConfig: () => AIConfig;
}

export function createAIRoutes(options: AIRouterOptions) {
  const router = new Hono();

  const getConfig = () => Promise.resolve(options.getConfig());

  // ─── Chat ───

  router.post("/chat/stream", async (c) => {
    const config = await getConfig();
    if (!config.apiKey) {
      return c.json({ error: "AI not configured" }, 503);
    }
    return handleChatStream(c, config);
  });

  router.post("/chat/generate", async (c) => {
    const config = await getConfig();
    if (!config.apiKey) {
      return c.json({ error: "AI not configured" }, 503);
    }
    return handleChatGenerate(c, config);
  });

  // ─── Task ───

  router.post("/task/generate", async (c) => {
    const config = await getConfig();
    if (!config.apiKey) {
      return c.json({ error: "AI not configured" }, 503);
    }
    return handleTaskGenerate(c, config);
  });

  router.post("/task/analyze", async (c) => {
    const config = await getConfig();
    if (!config.apiKey) {
      return c.json({ error: "AI not configured" }, 503);
    }
    return handleAnalyze(c, config);
  });

  // ─── Config ───

  router.get("/config", async (c) => {
    const config = await getConfig();
    return c.json(toPublicConfig(config));
  });

  router.put("/config", async (c) => {
    return c.json({ error: "Use PUT /api/ai/config instead" }, 400);
  });

  // ─── Models ───

  router.get("/models", (c) => {
    const provider = c.req.query("provider") as ProviderType | undefined;
    if (provider) {
      const found = PROVIDERS.find((p) => p.id === provider);
      return c.json(found ? found.models : []);
    }
    return c.json(PROVIDERS);
  });

  // ─── Health ───

  router.get("/health", async (c) => {
    const config = await getConfig();
    return c.json({
      configured: config.apiKey.length > 0,
      provider: config.provider,
      model: config.model,
    });
  });

  return router;
}
