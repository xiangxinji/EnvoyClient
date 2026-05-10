import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import bcrypt from "bcryptjs";

export interface AdminConfig {
  username: string;
  password: string; // bcrypt hash
}

export interface AISettings {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AppSettings {
  admin: AdminConfig;
  ai: AISettings;
}

const SETTINGS_PATH = join(homedir(), ".envoy", "manager.json");
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin123";

const DEFAULT_AI: AISettings = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o",
  temperature: 0.7,
  maxTokens: 4096,
};

export async function loadSettings(): Promise<AppSettings> {
  if (existsSync(SETTINGS_PATH)) {
    const raw = await readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as AppSettings;
    // Merge defaults for ai section (in case of old settings without it)
    parsed.ai = { ...DEFAULT_AI, ...parsed.ai };
    return parsed;
  }
  // First launch — create default admin
  const settings: AppSettings = {
    admin: {
      username: DEFAULT_USERNAME,
      password: await bcrypt.hash(DEFAULT_PASSWORD, 10),
    },
    ai: { ...DEFAULT_AI },
  };
  await saveSettings(settings);
  console.log(`[settings] Default admin created (username: ${DEFAULT_USERNAME}, password: ${DEFAULT_PASSWORD})`);
  return settings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const dir = join(homedir(), ".envoy");
  await mkdir(dir, { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

let settings: AppSettings;

export async function initSettings() {
  settings = await loadSettings();
}

export function getAdminConfig(): AdminConfig {
  return settings.admin;
}

export function getAIConfig(): AISettings {
  return settings.ai;
}

export async function updateAdmin(username: string, password: string): Promise<void> {
  settings.admin = { username, password: await bcrypt.hash(password, 10) };
  await saveSettings(settings);
  console.log(`[settings] Admin updated (${username})`);
}

export async function updateAIConfig(patch: Partial<AISettings>): Promise<AISettings> {
  settings.ai = { ...settings.ai, ...patch };
  await saveSettings(settings);
  return settings.ai;
}

export async function verifyAdmin(username: string, password: string): Promise<boolean> {
  if (username !== settings.admin.username) return false;
  return bcrypt.compare(password, settings.admin.password);
}
