## 1. useTheme 扩展

- [x] 1.1 在 useTheme.ts 中增加 `colorTheme` ref（类型 `"default" | "blue" | "purple"`），从 localStorage `envoy-color-theme` 初始化
- [x] 1.2 扩展 `apply()` 函数，同时设置 `document.documentElement.dataset.theme`；暗夜紫时强制 `class="dark"` 并冻结 toggle
- [x] 1.3 暴露 `setColorTheme(name)` 方法和 `isThemeLocked` computed
- [x] 1.4 暴露 `colorTheme` ref 供外部组件使用

## 2. CSS 主题变量

- [x] 2.1 在 variables.css 中添加 `:root[data-theme="blue"]` 变量覆盖（亮色版，15 个 accent 派生变量）
- [x] 2.2 在 variables.css 中添加 `:root[data-theme="blue"].dark` 变量覆盖（暗色版）
- [x] 2.3 在 variables.css 中添加 `:root[data-theme="purple"]` 变量覆盖（强制暗色背景 + 紫色 accent，亮暗统一）

## 3. UI 集成

- [x] 3.1 在 SettingsGeneral/main.vue 中添加主题选择 GlassSelect（default/blue/purple 三项）
- [x] 3.2 TitleBar 亮暗切换按钮在 `isThemeLocked` 时禁用或隐藏

## 4. 国际化

- [x] 4.1 添加主题名称的 i18n key（zh-CN / en）
