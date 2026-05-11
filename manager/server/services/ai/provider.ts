import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";
import type { AIConfig, ProviderType } from "../../../../shared/types/ai.js";
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS } from "./constants.js";

export function resolveModel(config: AIConfig): LanguageModelV1 {
  switch (config.provider) {
    case "openai":
      return createOpenAI({ apiKey: config.apiKey })(config.model) as LanguageModelV1;
    case "anthropic":
      return createAnthropic({ apiKey: config.apiKey })(config.model) as LanguageModelV1;
    case "google":
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model) as LanguageModelV1;
    case "deepseek":
      // DeepSeek API is OpenAI-compatible
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: "https://api.deepseek.com/v1",
      })(config.model) as LanguageModelV1;
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function getModelOptions(config: AIConfig) {
  return {
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
}
