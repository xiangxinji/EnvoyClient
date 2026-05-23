## Why

用户无法自定义界面主题色，当前仅有绿色 accent 一套配色。增加多套主题色选择可以满足个性化需求，提升视觉体验。

## What Changes

- 新增三套颜色主题：默认色（绿色）、科技蓝、暗夜紫
- 在 SettingsGeneral 通用设置中增加主题选择器（GlassSelect）
- 暗夜紫主题强制暗色背景，忽略亮暗切换
- 主题偏好存储在 localStorage，仅本地生效

## Capabilities

### New Capabilities
- `color-themes`: 多主题色切换能力，包含主题定义、切换逻辑、UI 选择器、暗夜紫强制暗色行为

### Modified Capabilities

## Impact

- `src/composables/useTheme.ts` — 增加 colorTheme ref、data-theme 属性设置、暗夜紫强制暗色逻辑
- `src/styles/variables.css` — 新增 `[data-theme="blue"]` 和 `[data-theme="purple"]` 变量覆盖
- `src/components/SettingsGeneral/main.vue` — 增加主题选择 GlassSelect
- `src/components/TitleBar/main.vue` — 暗夜紫时禁用亮暗切换按钮
