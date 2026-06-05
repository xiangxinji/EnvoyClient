import { computed } from "vue";
import { usePreferredReducedMotion } from "@vueuse/core";

/**
 * 检测用户是否开启了"减少动效"系统设置。
 * 封装 @vueuse/core 的 usePreferredReducedMotion，返回 boolean ref。
 */
export function useReducedMotion() {
  const preference = usePreferredReducedMotion();
  return computed(() => preference.value === "reduce");
}
