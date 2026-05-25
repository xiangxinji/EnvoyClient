## Why

当前 Agent 执行任务时（Planner → Executor → Reviewer 流水线），用户完全看不到中间过程。整个执行是黑盒——必须等任务完成后导航到 TaskDetailPanel 才能查看 trace。用户无法实时观察 AI 的推理过程、工具调用和执行进度，也无法在执行过程中了解 Agent 在做什么。

## What Changes

- 改造 `reactLoop` 增加可选的 `onEvent` 回调，在每步推理完成、工具调用前后 emit 事件
- 改造 `definePipeline` 透传事件回调，在 stage 切换时 emit 阶段事件（pipeline:start / stage:start / stage:end / pipeline:end）
- 新建 `useExecutionMonitor` composable（模块级单例），持有响应式执行状态供 UI 订阅
- 改造 `useTaskExecution` 在 `handleMemberExecution` 中将事件流接入 ExecutionMonitor
- 在左侧菜单 Tools 区新增"执行面板"入口（`__execution__`），与云盘、任务中心同级
- 新建 `ExecutionPanel` 面板组件，展示当前执行任务的实时 AI 输出（完整 reasoning + 工具调用详情）
- 新建 `ExecutionNotifier` 右上角悬浮提示组件，任务执行时显示状态通知，点击可跳转到执行面板
- 任务完成后清空执行状态

## Capabilities

### New Capabilities
- `execution-monitor`: 实时任务执行监控，包括事件流数据层和面板展示 UI

### Modified Capabilities
- `member-react-agent`: reactLoop 和 pipeline 增加事件回调支持（不改变现有行为，纯增量）

## Impact

- **数据层**: `src/agent/react.ts`（reactLoop 增加 onEvent 参数）、`src/agent/core/defineAgent.ts`、`src/agent/core/definePipeline.ts`、`src/agent/pipelines/taskPipeline.ts`
- **Composable**: 新建 `src/composables/useExecutionMonitor.ts`，修改 `src/composables/useTaskExecution.ts`
- **UI 组件**: 新建 `src/components/ExecutionPanel/`、`src/components/ExecutionNotifier/`
- **侧边栏**: 修改 `src/composables/useSidebarSearch.ts`（tools 列表加 `__execution__`）、`src/components/MemberSidebar/main.vue`（图标/描述映射）
- **主视图**: 修改 `src/views/ChatView/main.vue`（v-else-if 链加 ExecutionPanel + ExecutionNotifier）
- **i18n**: 添加 `sidebar.executionPanel`、`execution.*` 相关翻译
- **图标**: 使用现有 `terminal` 或 `pulse` 图标
