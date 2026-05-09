import { ref, watch } from "vue";

type Theme = "light" | "dark";

const STORAGE_KEY = "envoy-theme";

const current = ref<Theme>(
  (localStorage.getItem(STORAGE_KEY) as Theme) ?? "dark"
);

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
  current.value = theme;
}

export function useTheme() {
  apply(current.value);

  function toggle() {
    apply(current.value === "dark" ? "light" : "dark");
  }

  return { theme: current, toggle };
}
