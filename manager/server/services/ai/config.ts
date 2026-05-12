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

export { DEFAULT_CONFIG };

export function toPublicConfig(config: AIConfig): AIConfigPublic {
  return {
    provider: config.provider,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    configured: config.apiKey.length > 0,
  };
}
