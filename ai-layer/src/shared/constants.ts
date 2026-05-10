import type { ProviderType } from "./types";

export interface ProviderOption {
  id: ProviderType;
  label: string;
  models: string[];
}

export const PROVIDERS: ProviderOption[] = [
  {
    id: "openai",
    label: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o3-mini"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414", "claude-opus-4-20250514"],
  },
  {
    id: "google",
    label: "Google",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
];

export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_PROVIDER: ProviderType = "openai";
export const DEFAULT_MODEL = "gpt-4o";
