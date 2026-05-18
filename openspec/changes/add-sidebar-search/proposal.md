## Why

侧边栏导航目前只能通过鼠标点击或 `↑↓` 键顺序切换项目，当团队成员较多时，快速定位到特定成员或工具变得低效。需要一个搜索入口让用户通过名字、职责或能力关键词即时过滤导航项，缩短定位路径。

## What Changes

- 在侧边栏最顶部新增常驻搜索输入框，支持实时过滤工具和成员列表
- 工具过滤基于工具显示名称（i18n 文本），成员过滤基于 `name ∥ responsibilities ∥ capabilities`（OR 语义，大小写不敏感）
- 当成员通过职责或能力字段匹配时，在列表项下方显示匹配来源作为副标题
- 搜索无结果时显示空提示
- 输入框右侧提供清空按钮（✕）
- 新增 `Ctrl+K` 全局快捷键聚焦搜索框
- 现有 `↑↓` 键盘导航适配为基于过滤后列表的跳转
- 新增 `GlassInput.vue` 基础输入框组件，遵循毛玻璃设计系统规范

## Capabilities

### New Capabilities

- `sidebar-search`: 侧边栏搜索过滤功能——搜索输入框、过滤逻辑（工具名 + 成员名/职责/能力）、匹配提示、空状态、键盘快捷键
- `glass-input`: 基础毛玻璃输入框控件，36px 高度，遵循项目 Glass Design System，作为基础控件封装规范的一部分

### Modified Capabilities

（无需修改现有 capability 规格——搜索只读取已有的 `MemberInfo.responsibilities` 和 `MemberInfo.capabilities` 数据，不改变其存储或管理行为）

## Impact

- **前端组件**: `MemberSidebar.vue`（新增搜索框 UI + 过滤逻辑）、`useGlobalShortcuts.ts`（新增 Ctrl+K）
- **新增组件**: `GlassInput.vue`、`SidebarSearch.vue`（搜索逻辑封装）
- **i18n**: `en.json`、`zh-CN.json` 新增搜索相关文案
- **无后端改动**: 搜索完全在前端本地完成，不涉及 API 变更
- **无破坏性变更**: 搜索框为纯增量功能，不影响现有导航行为
