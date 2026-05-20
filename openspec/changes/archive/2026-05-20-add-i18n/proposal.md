## Why

Client 前端 24 个文件中有 274 条硬编码中文字符串，无法切换为其他语言。需要添加国际化支持，使应用可在简体中文和英文之间切换，默认简体中文。

## What Changes

- 安装 `vue-i18n` 并在 Vue 应用中注册为插件
- 创建 `src/i18n/` 模块：i18n 实例配置 + `useLocale()` composable（locale 响应式状态 + localStorage 持久化 + 语言切换方法）
- 创建 `src/i18n/zh-CN.json` 和 `src/i18n/en.json` 翻译文件，按功能域组织（`common.*`, `settings.*`, `chat.*`, `task.*`, `role.*`, `notification.*`）
- 将 Client 前端（`src/`）所有组件和 composable 中的硬编码中文提取为 `t()` 调用
- 在 SettingsPanel 中添加语言切换下拉选择器（使用现有 `GlassSelect` 组件）
- 语言偏好持久化到 localStorage（key: `envoy-locale`），默认 `zh-CN`
- Agent 工具描述（`src/agent/tools.ts`）保持不变

## Capabilities

### New Capabilities
- `i18n`: 客户端国际化基础设施 — vue-i18n 插件注册、翻译文件组织、useLocale composable、语言切换 UI、localStorage 持久化

### Modified Capabilities
- `member-settings`: SettingsPanel 新增语言选择设置项
- `role-selection`: 登录页所有 UI 文本国际化
- `team-chat`: 聊天面板所有 UI 文本国际化
- `task-center`: 任务中心所有 UI 文本国际化（含任务状态标签统一）
- `task-dispatch`: 任务分派面板所有 UI 文本国际化

## Impact

- **依赖**: 新增 `vue-i18n` npm 包
- **文件变更**: `src/` 下约 24 个文件需要修改（17 个 `.vue` + 7 个 `.ts`），涉及模板和脚本中的硬编码文本替换
- **新增文件**: `src/i18n/index.ts`, `src/i18n/zh-CN.json`, `src/i18n/en.json`
- **无 API 变更**: 纯前端变更，不影响后端和 Tauri 命令
- **无破坏性变更**: 默认行为与当前一致（简体中文）
