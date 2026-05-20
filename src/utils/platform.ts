import { invoke } from "@tauri-apps/api/core";

export const isTauri = "__TAURI_INTERNALS__" in window;

export async function safeInvoke<T = unknown>(cmd: string, args: Record<string, unknown> = {}): Promise<T | null> {
  if (!isTauri) return null;
  return await invoke<T>(cmd, args);
}
