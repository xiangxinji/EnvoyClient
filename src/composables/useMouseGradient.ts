import { ref, type Ref } from 'vue';

export interface MouseGradientOptions {
  /** 初始 X 位置百分比 (0-100)，默认 50 */
  initialX?: number;
  /** 初始 Y 位置百分比 (0-100)，默认 50 */
  initialY?: number;
  /** 渐变半径，默认 320 */
  radius?: number;
  /** 渐变透明度，默认 0.06 */
  opacity?: number;
}

/**
 * 封装鼠标跟随渐变高亮效果
 * @param elementRef 要监听的元素引用
 * @param options 配置选项
 */
export function useMouseGradient(
  elementRef: Ref<HTMLElement | null>,
  options: MouseGradientOptions = {}
) {
  const {
    initialX = 50,
    initialY = 50,
    radius = 320,
    opacity = 0.06,
  } = options;

  const mouseX = ref(`${initialX}%`);
  const mouseY = ref(`${initialY}%`);

  function onMouseMove(e: MouseEvent) {
    const el = elementRef.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseX.value = `${e.clientX - rect.left}px`;
    mouseY.value = `${e.clientY - rect.top}px`;
    el.style.setProperty('--mouse-x', mouseX.value);
    el.style.setProperty('--mouse-y', mouseY.value);
  }

  function onMouseLeave() {
    const el = elementRef.value;
    if (!el) return;
    mouseX.value = `${initialX}%`;
    mouseY.value = `${initialY}%`;
    el.style.setProperty('--mouse-x', mouseX.value);
    el.style.setProperty('--mouse-y', mouseY.value);
  }

  return {
    mouseX,
    mouseY,
    onMouseMove,
    onMouseLeave,
    radius,
    opacity,
  };
}
