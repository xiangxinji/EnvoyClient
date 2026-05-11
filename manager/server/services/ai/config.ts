import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AIConfig, AIConfigPublic } from "../../../../shared/types/ai.js";
import {
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
} from "./constants.js";

const DEFAULT_CONFIG: AIConfig = {
  provider: DEFAULT_PROVIDER,
  apiKey: "",
  model: DEFAULT_MODEL,
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS,
};

export async function loadConfig(configPath: string): Promise<AIConfig> {
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(
  configPath: string,
  config: AIConfig,
): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function toPublicConfig(config: AIConfig): AIConfigPublic {
  return {
    provider: config.provider,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    configured: config.apiKey.length > 0,
  };
}
