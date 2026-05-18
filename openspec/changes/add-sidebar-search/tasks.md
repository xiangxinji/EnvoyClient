## 1. GlassInput 基础控件

- [x] 1.1 创建 `src/components/GlassInput.vue`：支持 `v-model`、`placeholder`、`clearable` prop，`#prefix` 插槽，`clear` 事件；36px 高度，`--glass-bg-light` 背景，`--glass-border` 边框，focus 时 border 变 `--accent`；双色 CSS 变量，无硬编码颜色

## 2. 搜索 Composable

- [x] 2.1 创建 `src/composables/useSidebarSearch.ts`：接收 `members` reactive 列表 + `t()` i18n 函数，返回 `searchQuery` ref、`filteredTools`、`filteredMembers`、`matchHints` Map、`filteredNavItems`、`isEmpty`；过滤逻辑为大小写不敏感 includes，成员匹配 name / responsibilities / capabilities (OR)
- [x] 2.2 matchHints 逻辑：当成员仅通过 responsibilities 或 capabilities 匹配时记录提示文本（如 `"Responsibilities: 前端开发"`），名字匹配时不记录；多字段匹配时名字优先

## 3. i18n 文案

- [x] 3.1 在 `en.json` 和 `zh-CN.json` 的 `sidebar` 下新增：`searchPlaceholder`（搜索框占位文本）、`noResults`（空状态提示）、`searchClear`（清空按钮 aria）

## 4. MemberSidebar 集成

- [x] 4.1 在 MemberSidebar 模板顶部（Tools header 上方）添加 GlassInput 搜索框，使用 `#prefix` 插槽放搜索图标，`clearable` 模式，绑定 `searchQuery`
- [x] 4.2 工具列表 (`nav-group:first-of-type`) 改为遍历 `filteredTools`，当 `filteredTools` 为空时隐藏 Tools 整个分组（header + list）
- [x] 4.3 成员列表 (`nav-group:last-of-type`) 改为遍历 `filteredMembers`，匹配到非名字字段时在成员项下方渲染 `matchHints` 副标题（小字，`--text-muted` 色）
- [x] 4.4 当 `searchQuery` 非空且 `isEmpty` 为 true 时，在两个分组区域显示空状态提示

## 5. 键盘交互

- [x] 5.1 在 MemberSidebar 添加 window keydown listener：`Ctrl+K` 聚焦搜索输入框 ref，`Escape` 清空 query 并 blur；排除 INPUT/TEXTAREA/contentEditable 中的 Ctrl+K（避免与编辑器快捷键冲突）
- [x] 5.2 修改现有 `handleKeyDown`（↑↓ 逻辑），将 `navItems` 替换为 composable 返回的 `filteredNavItems`，搜索为空时行为与原来一致
