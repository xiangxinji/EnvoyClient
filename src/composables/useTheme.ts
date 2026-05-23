import { ref, computed } from "vue";

type Theme = "light" | "dark";
type ColorTheme = "default" | "blue" | "purple";

const STORAGE_KEY = "envoy-theme";
const COLOR_STORAGE_KEY = "envoy-color-theme";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return (stored === "light" || stored === "dark") ? stored : getSystemTheme();
}

function getInitialColorTheme(): ColorTheme {
  const stored = localStorage.getItem(COLOR_STORAGE_KEY);
  return (stored === "blue" || stored === "purple") ? stored : "default";
}

const current = ref<Theme>(getInitialTheme());
const colorTheme = ref<ColorTheme>(getInitialColorTheme());
const isThemeLocked = computed(() => colorTheme.value === "purple");

function apply(theme: Theme, color: ColorTheme) {
  const el = document.documentElement;
  if (color === "purple") {
    el.classList.add("dark");
  } else {
    el.classList.toggle("dark", theme === "dark");
  }
  el.dataset.theme = color;
  localStorage.setItem(STORAGE_KEY, theme);
  localStorage.setItem(COLOR_STORAGE_KEY, color);
  current.value = theme;
  colorTheme.value = color;
}

export function useTheme() {
  apply(current.value, colorTheme.value);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      apply(e.matches ? "dark" : "light", colorTheme.value);
    }
  });

  function toggle() {
    if (colorTheme.value === "purple") return;
    apply(current.value === "dark" ? "light" : "dark", colorTheme.value);
  }

  function setColorTheme(name: ColorTheme) {
    apply(current.value, name);
  }

  return { theme: current, colorTheme, isThemeLocked, toggle, setColorTheme };
}
