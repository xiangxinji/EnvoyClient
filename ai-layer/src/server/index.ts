import { Hono } from "hono";
import type { AIConfig, AIConfigPublic, ProviderType } from "../shared/types";
import { PROVIDERS } from "../shared/constants";
import { loadConfig, saveConfig, toPublicConfig } from "./config";
import { handleChatStream, handleChatGenerate } from "./chat";
import { handleTaskGenerate } from "./task";
import { handleAnalyze } from "./analyze";

export interface AIRouterOptions {
  configPath: string;
}

export function createAIRoutes(options: AIRouterOptions) {
  const router = new Hono();

  const getConfig = () => loadConfig(options.configPath);

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
    const body = await c.req.json<Partial<AIConfig>>();
    const current = await getConfig();

    const updated: AIConfig = {
      provider: body.provider ?? current.provider,
      apiKey: body.apiKey ?? current.apiKey,
      model: body.model ?? current.model,
      temperature: body.temperature ?? current.temperature,
      maxTokens: body.maxTokens ?? current.maxTokens,
    };

    await saveConfig(options.configPath, updated);
    return c.json(toPublicConfig(updated));
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
