## Why

当前 Agent 系统（planner、executor、reviewer、scorer）缺乏可视化管理界面。用户无法直观查看各 Agent 的提示词、可用工具和运行状态，也无法感知哪个 Agent 正在工作。随着 Agent 数量增加，需要一个集中、可扩展的管理面板。

## What Changes

- 新增 `src/agent/registry.ts`：Agent 元数据注册表，集中管理名称、中文标签、图标、工具中文名映射，新增 Agent 只需添加一条记录
- 新增 ActivityBar 图标（`__agents__`），点击打开 Agent 列表面板
- 新增 `AgentPanel` 组件：卡片网格展示所有 Agent，每张卡片显示图标+中文名+运行状态
- 新增 Agent Drawer：点击卡片滑出详情，展示提示词、工具列表（中文名）、步骤上限

## Capabilities

### New Capabilities
- `agent-registry-panel`: Agent 元数据注册表 + 可视化管理面板，卡片网格展示所有 Agent，Drawer 展示详情

### Modified Capabilities

## Impact

- **新增文件**: `src/agent/registry.ts`、`src/components/AgentPanel/main.vue`、`src/components/AgentPanel/styles.css`
- **修改文件**: `src/components/ActivityBar/main.vue`（新增 `__agents__` 图标）
- **修改文件**: `src/views/ChatView/main.vue`（注册 AgentPanel、处理 `__agents__` 路由）
