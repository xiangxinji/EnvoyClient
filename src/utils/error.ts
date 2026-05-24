import { i18n } from "../i18n";

const ERROR_KEY_MAP: Record<string, string> = {
  "Not connected": "error.notConnected",
  "Connection failed": "error.connectionFailed",
  "WebSocket error": "error.websocketError",
  "DUPLICATE_LOGIN": "error.duplicateLogin",
};

export function getErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const key = ERROR_KEY_MAP[raw];
  if (key) {
    const t = i18n.global.t;
    const translated = t(key);
    return translated !== key ? translated : raw;
  }
  return raw;
}
