## Context

当前 Agent 执行流水线（Planner → Executor → Reviewer）是封闭的黑盒。`reactLoop` 阻塞执行所有步骤后一次性返回 `{ result, trace }`，`definePipeline` 顺序执行各 stage 后返回 `PipelineResult`。中间过程对用户完全不可见。

用户只能在任务完成后导航到 TaskDetailPanel 查看历史 trace，无法实时观察 AI 推理、工具调用和执行进度。

## Goals / Non-Goals

**Goals:**
- 在 reactLoop 的每个关键节点（推理完成、工具调用、工具返回）实时通知外部
- 在 pipeline 的 stage 切换时（pipeline:start, stage:start, stage:end, pipeline:end）实时通知外部
- 提供模块级单例 `useExecutionMonitor` 持有响应式执行状态，UI 可订阅
- 左侧侧边栏 Tools 区新增"执行面板"入口，右侧展示实时执行输出
- 右上角悬浮提示通知任务执行状态，点击跳转执行面板
- 任务完成后清空执行状态

**Non-Goals:**
- 不改造 AI 推理端点（仍是 POST /api/ai/agent/reason），不做流式 token 输出
- 不改造 pipeline 的 stage 定义或执行逻辑，只加事件通知
- 不存储历史执行记录（每次新任务覆盖旧数据）
- 不做 Leader review 路径的实时展示（仅 Member 执行路径）

## Decisions

### 1. 事件传递：回调函数 vs EventBus vs EventEmitter

**选择：可选回调参数 `onEvent`**

- `reactLoop(taskContent, tools, currentStep, error, workspacePath, skillCatalog, maxSteps, onEvent?)` 增加最后一个可选参数
- `definePipeline` 和 `defineAgent` 同样透传 `onEvent`
- 不传 `onEvent` 时行为与现在完全一致（向后兼容）

**理由**：数据流是线性的（reactLoop → defineAgent → definePipeline → useTaskExecution → ExecutionMonitor），不需要广播或跨组件通信。回调参数最简单、类型安全、零依赖。

**备选**：mitt EventBus — 过重，只有一个消费者。

### 2. ExecutionMonitor 状态：模块级单例

**选择**：`useExecutionMonitor.ts` 作为模块级单例 composable

```ts
// 模块级响应式状态
const state = reactive<ExecutionState>({ ... });

export function useExecutionMonitor() {
  return { ...toRefs(state), startExecution, clearExecution, emit };
}
```

**理由**：
- 同一时刻只有一个任务在执行，单例天然匹配
- 不依赖 provide/inject，任何组件都能直接 import 使用
- 与 `teamClientContext.ts` 的单例模式一致

### 3. 面板 UI：标准侧边栏面板模式

**选择**：跟 TaskCenter / CloudResources 一样的模式 — `selectedPeer === "__execution__"` 时右侧展示 ExecutionPanel

**理由**：复用现有路由和过渡动效，不需要新的布局机制。

### 4. 右上角通知：ChatView 内 fixed 定位

**选择**：`ExecutionNotifier` 组件放在 ChatView 内，`position: fixed` + `top/right` 定位在右上角

**理由**：
- 跟 ReconnectOverlay 一样的模式（已在 ChatView 内）
- 任务执行时出现，完成后消失，不影响主内容
- 点击通知切换 `selectedPeer` 到 `__execution__`

### 5. 事件类型设计

```ts
type ExecutionEvent =
  | { type: "pipeline:start"; taskId: string; taskContent: string }
  | { type: "stage:start"; stage: string; attempt: number }
  | { type: "step:reasoning"; stage: string; stepIndex: number; reasoning: string }
  | { type: "step:tool_call"; stage: string; stepIndex: number; toolName: string; args: Record<string, unknown> }
  | { type: "step:tool_result"; stage: string; stepIndex: number; toolName: string; result: unknown }
  | { type: "stage:end"; stage: string; result: string }
  | { type: "pipeline:end"; success: boolean; summary: string };
```

## Risks / Trade-offs

- **[回调穿透层级深]** reactLoop → defineAgent → definePipeline → useTaskExecution，每层都需要透传 `onEvent` 参数 → 各层接口只是加一个可选参数，复杂度可控
- **[无流式 token]** AI 推理仍然是整段返回，不是逐 token → 用户看到的是"一段 reasoning 突然出现"而非逐字打字效果。这是 AI 端点的限制，当前可接受
- **[单任务限制]** ExecutionMonitor 只追踪当前正在执行的一个任务 → 匹配实际场景（Member 同一时刻只执行一个任务）
- **[内存]** reasoning 文本可能很长 → 任务完成后 clearExecution 清空，不累积
