import { createI18n } from "vue-i18n";
import zhCN from "./zh-CN.json";
import en from "./en.json";
import { isTauri } from "../utils/platform";

export type Locale = "zh-CN" | "en";

const STORAGE_KEY = "envoy-locale";
const DEFAULT_LOCALE: Locale = "zh-CN";
export const AVAILABLE_LOCALES: Locale[] = ["zh-CN", "en"];

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "zh-CN" || stored === "en") return stored;
  return DEFAULT_LOCALE;
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: "zh-CN",
  messages: { "zh-CN": zhCN, en },
});

function applyLocale(lang: Locale) {
  i18n.global.locale.value = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.setAttribute("lang", lang);
}

async function persistToSettings(lang: Locale) {
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

export function useLocale() {
  async function switchLocale(lang: Locale) {
    applyLocale(lang);
    await persistToSettings(lang);
  }

  async function loadFromSettings() {
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

  return {
    locale: i18n.global.locale,
    switchLocale,
    loadFromSettings,
    availableLocales: AVAILABLE_LOCALES,
  };
}
