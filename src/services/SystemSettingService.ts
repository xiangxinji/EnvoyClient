import { isTauri } from "../utils/platform";
import { i18n, applyLocale } from "../i18n";
import type { Locale } from "../i18n";

export class SystemSettingService {
  get locale(): Locale {
    return i18n.global.locale.value as Locale;
  }

  async switchLocale(lang: Locale): Promise<void> {
    applyLocale(lang);
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const settings = (await invoke("get_settings")) as Record<string, unknown>;
      const env = (settings.env as Record<string, unknown>) || {};
      env.locale = lang;
      settings.env = env;
      await invoke("save_settings", { settings });
    } catch {}
  }

  async loadLocaleFromSettings(): Promise<void> {
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const settings = (await invoke("get_settings")) as Record<string, unknown>;
      const env = settings.env as Record<string, unknown> | undefined;
      const stored = env?.locale;
      if (stored === "zh-CN" || stored === "en") {
        applyLocale(stored);
      }
    } catch {}
  }
}
