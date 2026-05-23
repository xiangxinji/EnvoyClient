## Context

当前 `variables.css` 通过 `:root`（亮色）和 `html.dark`（暗色）定义全套 CSS 变量。accent 色为绿色（`#2daa82`/`#2ea87a`），被 ~66 个文件引用。亮暗模式通过 `useTheme.ts` 在 `<html>` 上切换 `dark` class，偏好存 localStorage。

## Goals / Non-Goals

**Goals:**
- 支持三套主题色切换：默认绿、科技蓝、暗夜紫
- 暗夜紫主题强制暗色背景，忽略亮暗切换
- 主题偏好仅存 localStorage，跟随设备
- 改动集中在 4 个文件，不动 yml/后端

**Non-Goals:**
- 不做自定义颜色/色板选取器
- 不做跨设备主题同步
- 不改变现有亮暗模式切换机制（非暗夜紫时行为不变）

## Decisions

### 1. 使用 `data-theme` 属性而非额外 class

在 `<html>` 上设置 `data-theme="blue"` / `data-theme="purple"`，配合 CSS 选择器覆盖变量。

**理由**: `data-*` 属性语义明确，不与现有 `class="dark"` 冲突，CSS 选择器 `[data-theme="blue"]` 可读性好。

**备选**: 多 class（如 `theme-blue`）——容易与 dark class 混淆。

### 2. CSS 变量覆盖策略

每个主题只覆盖 accent 相关的 ~15 个变量，不重复定义背景/边框等中性变量：

```
:root[data-theme="blue"]          { --accent, --accent-hover, --accent-light, ... }
:root[data-theme="blue"].dark     { 暗色版 accent 派生变量 }
:root[data-theme="purple"]        { 强制暗色背景 + 紫色 accent（亮暗统一） }
```

暗夜紫不需要 `.dark` 变体，因为亮暗变量完全相同。

### 3. useTheme 扩展方式

在现有 `useTheme.ts` 中增加 `colorTheme` ref 和 `setColorTheme()` 方法，不拆分文件。`apply()` 同时处理 `class="dark"` 和 `data-theme`。

### 4. 暗夜紫的亮暗切换处理

`useTheme` 暴露 `isThemeLocked` computed，当 `colorTheme === "purple"` 时为 true。TitleBar 的亮暗切换按钮根据此值隐藏或禁用。

## Risks / Trade-offs

- **变量遗漏风险**: accent 派生变量约 15 个，遗漏某个会导致该元素颜色不跟随主题。→ 逐项对照 `variables.css` 中的 accent 引用变量，确保每套主题全部覆盖。
- **暗夜紫强制暗色的过渡体验**: 用户选暗夜紫时如果当前是亮色，会瞬间切换为暗色背景。→ 可接受，因为主题切换本身就是全局视觉变化。
