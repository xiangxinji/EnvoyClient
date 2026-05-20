## ADDED Requirements

### Requirement: vue-i18n plugin registration
系统 SHALL 在 Vue 应用入口（`main.ts`）注册 vue-i18n 插件，提供 `$t()` 全局方法和 `useI18n()` composable。

#### Scenario: i18n plugin available in all components
- **WHEN** Vue 应用启动完成
- **THEN** 所有组件可通过 `{{ $t('key') }}` 或 `const { t } = useI18n()` 访问翻译函数

#### Scenario: 未注册的 key 回退到 key 本身
- **WHEN** 组件调用 `t('nonexistent.key')`
- **THEN** 返回 key 字符串 `"nonexistent.key"` 作为显示文本

### Requirement: Translation file structure
系统 SHALL 提供 `src/i18n/zh-CN.json` 和 `src/i18n/en.json` 两个翻译文件，按功能域嵌套组织。支持的功能域：`common`, `role`, `chat`, `task`, `settings`, `notification`, `sidebar`, `titlebar`。

#### Scenario: zh-CN.json 包含所有 key
- **WHEN** 应用加载
- **THEN** `zh-CN.json` 包含所有界面文本的中文翻译，无遗漏 key

#### Scenario: en.json 包含所有 key
- **WHEN** 应用加载
- **THEN** `en.json` 包含所有界面文本的英文翻译，结构与 `zh-CN.json` 完全一致

### Requirement: useLocale composable
系统 SHALL 提供 `useLocale()` composable，返回当前语言（`locale`）、切换方法（`switchLocale`）和可用语言列表（`availableLocales`）。

#### Scenario: 获取当前语言
- **WHEN** 组件调用 `useLocale()`
- **THEN** 返回的 `locale` ref 值为当前语言代码（`zh-CN` 或 `en`）

#### Scenario: 切换语言
- **WHEN** 调用 `switchLocale('en')`
- **THEN** 所有已渲染的 `t()` 调用立即返回英文翻译，`locale` ref 更新为 `en`

#### Scenario: 获取可用语言列表
- **WHEN** 组件调用 `useLocale()`
- **THEN** 返回 `availableLocales` 数组为 `['zh-CN', 'en']`

### Requirement: Language persistence
语言偏好 SHALL 持久化到 localStorage，key 为 `envoy-locale`。应用启动时 SHALL 读取该值，未设置时默认 `zh-CN`。

#### Scenario: 首次启动无存储值
- **WHEN** localStorage 中无 `envoy-locale` 键
- **THEN** 系统使用 `zh-CN` 作为默认语言

#### Scenario: 切换语言后持久化
- **WHEN** 用户将语言切换为 `en`
- **THEN** localStorage `envoy-locale` 值设为 `en`

#### Scenario: 重启后恢复语言
- **WHEN** 应用重新启动，localStorage `envoy-locale` 值为 `en`
- **THEN** 系统以英文界面启动

### Requirement: Language switcher UI
SettingsPanel SHALL 提供语言切换下拉选择器，使用 GlassSelect 组件，选项为"简体中文"和"English"。

#### Scenario: 显示当前语言
- **WHEN** 用户打开设置面板
- **THEN** 语言选择器显示当前语言对应的选项文本

#### Scenario: 切换语言
- **WHEN** 用户在下拉框中选择"English"
- **THEN** 整个界面立即切换为英文显示，语言偏好持久化

#### Scenario: 语言选项始终使用原生语言显示
- **WHEN** 当前语言为英文
- **THEN** 下拉框中仍显示"简体中文"而非"Simplified Chinese"，"English"保持不变
