## Context

ActivityBar 已有 5 个导航图标（Chat、Cloud、Tasks、Execution、Dispatch），通过 `selectedPeer` ref 切换内容面板。Agent 系统有 4 个 Agent（planner、executor、reviewer、scorer），各自有独立的提示词、工具集和 maxSteps。

运行状态通过 `useExecutionMonitor` 的 `status.currentStage` 获取，其值为 agent name（如 "planner"、"executor"）。

## Goals / Non-Goals

**Goals:**
- 易维护的 Agent 元数据注册表，新增 Agent 只需加一条记录
- 卡片网格展示所有 Agent（图标 + 中文名 + 运行状态）
- Drawer 展示 Agent 详情（提示词、工具中文名列表、步骤上限）
- 中文化 Agent 名称和工具名称
- ActivityBar 新增图标入口

**Non-Goals:**
- 不支持在线编辑提示词或工具配置
- 不支持启动/停止 Agent（仅展示）
- 不新增 Tauri 命令

## Decisions

### 1. Agent Registry 数据结构

**选择**：新建 `src/agent/registry.ts`，导出 `AGENT_REGISTRY` 数组，每项包含 `{ id, name, label, icon, tools, maxSteps, instructions }`

**理由**：集中管理，新增 Agent 只需 push 一条记录。`tools` 字段是 `{ name: string, label: string }[]`，存储工具 ID 和中文标签。

### 2. 运行状态获取

**选择**：从 `useExecutionMonitor` 的 `status.currentStage` 读取，与 registry 中的 `id` 匹配

**理由**：ExecutionMonitor 已在全局追踪执行状态，无需新增状态管理。当 `status.status === "running"` 且 `status.currentStage === agent.id` 时，该 Agent 显示为运行中。

### 3. Drawer 实现

**选择**：面板内嵌 Drawer（非 Teleport），点击卡片切换 `selectedAgentId`，右侧区域滑入详情

**理由**：与现有的面板切换模式一致，不需要额外的 Teleport 层。Drawer 使用 `slideRight` 动效预设。

### 4. 卡片布局

**选择**：CSS Grid，`grid-template-columns: repeat(auto-fill, minmax(100px, 1fr))`，自动换行

**理由**：未来新增 Agent 卡片自然流入网格，不需要调整布局代码。

### 5. 提示词展示

**选择**：从 registry 中的 `instructions` 字段直接读取（字符串），在 Drawer 中以只读文本区域展示

**理由**：提示词在定义 Agent 时已确定，直接从 registry 展示即可。

## Risks / Trade-offs

- [提示词可能很长] → Drawer 中使用可滚动文本区域，限制视觉噪音
- [运行状态依赖 ExecutionMonitor] → 仅在任务执行期间有状态，空闲时所有 Agent 显示"空闲"，这是预期行为
