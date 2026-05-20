## Context

MemberSidebar 是应用主界面的左侧导航面板（当前 ~550 行），展示工具入口（Cloud Resources、Task Center、Task Dispatch）和团队成员列表。导航通过鼠标点击或 `↑↓` 键盘切换，无搜索/过滤能力。

成员数据 (`MemberInfo`) 已包含 `responsibilities` 和 `capabilities` 可选字段，从 Manager API 加载，在 TaskDispatchPanel 的 AI 智能分派中已在使用。搜索可以复用这些数据，无需后端改动。

现有 `useGlobalShortcuts.ts` 管理 Tauri 级全局快捷键（跨窗口生效），`Ctrl+K` 只需在应用窗口内生效，应使用普通 `window.addEventListener("keydown")` 而非 Tauri global shortcut API。

## Goals / Non-Goals

**Goals:**

- 侧边栏顶部常驻搜索框，实时过滤工具和成员
- 成员搜索支持 name / responsibilities / capabilities 三维 OR 匹配
- 匹配到非名字字段时显示匹配来源副标题
- Ctrl+K 聚焦搜索框，Escape 清空并失焦
- ↑↓ 键盘导航基于过滤后列表
- 新增 GlassInput 基础控件组件

**Non-Goals:**

- 不做消息内容搜索（仅搜索导航项）
- 不做搜索历史 / 最近搜索
- 不做模糊匹配 / 拼音搜索（精确 substring 匹配即可）
- 不涉及后端 API 变更

## Decisions

### 1. 搜索逻辑封装为 composable 而非子组件

**选择**: 新增 `useSidebarSearch.ts` composable，封装过滤逻辑和状态（`searchQuery`、`filteredTools`、`filteredMembers`、`matchHints`）。

**理由**: MemberSidebar 已经 ~550 行，接近项目 300 行组件限制（大量样式）。搜索逻辑有独立状态（query、filter 结果、match hint map），抽成 composable 可以保持 MemberSidebar 的模板聚焦于渲染，也便于单元测试过滤逻辑。

**替代方案**: 创建 `SidebarSearch.vue` 子组件 — 但搜索结果需要控制 MemberSidebar 的两个 `nav-group` 列表渲染，拆成子组件会导致父子之间大量 props/events 传递，composable 更自然。

### 2. GlassInput 作为独立基础控件

**选择**: 新增 `src/components/GlassInput.vue`，遵循 Glass Design System light 层级（嵌套在 sidebar 的 standard glass 内），36px 高度，支持 `v-model`、`placeholder`、`clearable` 属性。

**样式**: 使用 `--glass-bg-light` 背景（不需要自己的 blur，嵌套在已有 blur 容器内），`--glass-border` 边框，统一 `height: 36px`。

### 3. Ctrl+K 使用 window keydown 而非 Tauri Global Shortcut

**选择**: 在 MemberSidebar 的 `onMounted` 中注册 `window.addEventListener("keydown")`，监听 `Ctrl+K`，调用 `searchInputRef.value?.focus()`。

**理由**: `useGlobalShortcuts.ts` 使用 Tauri global shortcut API，快捷键在窗口失焦时也生效，适用于"切换 AI 自动回复"这类全局操作。搜索框聚焦只在窗口内有效，用原生 keydown 更简单，避免注册/反注册 Tauri 快捷键的复杂度。

**Escape 处理**: 同一 listener 中监听 `Escape`，清空 query 并 blur 输入框。

### 4. 过滤逻辑：computed + case-insensitive includes

**选择**:

```
过滤工具: toolLabel.toLowerCase().includes(query.toLowerCase())
过滤成员: [m.id, m.responsibilities, m.capabilities]
          .filter(Boolean)
          .some(field => field.toLowerCase().includes(query.toLowerCase()))
```

**Match hint**: composable 返回 `matchHints: Map<string, string>`，当成员通过非名字字段匹配时，记录匹配到的字段标签（如 `"Responsibilities: 前端开发"`），模板中条件渲染为小字副标题。

### 5. ↑↓ 键盘导航适配

**选择**: 修改现有 `handleKeyDown`，将 `navItems` computed 替换为 `filteredNavItems`（搜索时的过滤列表），无搜索时等于原始 `navItems`。

### 6. 文件结构

```
src/components/GlassInput.vue          ← 新增：基础输入框控件
src/composables/useSidebarSearch.ts    ← 新增：搜索过滤 composable
src/components/MemberSidebar.vue       ← 修改：集成搜索框 + 使用 composable
src/composables/useGlobalShortcuts.ts  ← 不改（Ctrl+K 在 MemberSidebar 内处理）
src/i18n/en.json                       ← 修改：新增搜索文案
src/i18n/zh-CN.json                    ← 修改：新增搜索文案
```

## Risks / Trade-offs

- **MemberSidebar 行数增长** → 通过 composable 拆分逻辑控制增长，模板部分的增量控制在 ~30 行（搜索框 + 空状态 + match hint）
- **搜索框占据侧边栏垂直空间** → 搜索框高度 36px + padding，占 sidebar 220px 宽度中约 40px，可接受
- **responsibilities/capabilities 数据可能为空** → 过滤逻辑已用 `.filter(Boolean)` 处理，空字段不影响匹配
- **i18n 工具名匹配** → 工具名通过 `t('sidebar.xxx')` 获取当前语言文本，搜索时用翻译后的文本匹配
