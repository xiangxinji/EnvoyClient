## ADDED Requirements

### Requirement: ExecutionMonitor 事件流

系统 SHALL 提供 `useExecutionMonitor` composable 作为模块级单例，接收并暴露 Agent 执行过程的实时事件流。

`ExecutionEvent` 类型 SHALL 包含以下事件：
- `pipeline:start` — 流水线开始，携带 `taskId` 和 `taskContent`
- `stage:start` — 阶段开始，携带 `stage`（planner/executor/reviewer）和 `attempt`
- `step:reasoning` — AI 推理完成，携带 `stepIndex` 和 `reasoning` 文本
- `step:tool_call` — 工具即将执行，携带 `toolName` 和 `args`
- `step:tool_result` — 工具执行完毕，携带 `toolName` 和 `result`
- `stage:end` — 阶段结束，携带 `result`
- `pipeline:end` — 流水线结束，携带 `success` 和 `summary`

#### Scenario: 接收 pipeline:start 事件
- **WHEN** Agent 流水线开始执行任务 #123 "修复登录Bug"
- **THEN** ExecutionMonitor SHALL 记录 `taskId: "123"`, `taskContent: "修复登录Bug"`, `status: "running"`

#### Scenario: 接收 step:reasoning 事件
- **WHEN** Executor 阶段第 3 步 AI 推理完成
- **THEN** ExecutionMonitor SHALL 在 entries 中追加一条记录，包含 `stage: "executor"`, `stepIndex: 3`, `reasoning` 文本

#### Scenario: 接收 step:tool_call 和 step:tool_result 事件
- **WHEN** Agent 调用 shell("npm test") 并获得返回结果
- **THEN** ExecutionMonitor SHALL 先追加 tool_call 记录（toolName: "shell", args），再追加 tool_result 记录（toolName: "shell", result）

#### Scenario: 接收 pipeline:end 事件
- **WHEN** 流水线执行完成
- **THEN** ExecutionMonitor SHALL 将 `status` 更新为 `"done"`，记录 `success` 和 `summary`

#### Scenario: clearExecution 清空状态
- **WHEN** 调用 `clearExecution()`
- **THEN** 所有执行状态（taskInfo, entries, status）SHALL 重置为初始空状态

### Requirement: ExecutionMonitor 响应式状态

`useExecutionMonitor` SHALL 暴露以下响应式状态：

- `status: Ref<"idle" | "running" | "done">` — 当前执行状态
- `taskInfo: Ref<{ taskId: string; taskContent: string } | null>` — 当前任务信息
- `currentStage: Ref<string>` — 当前执行阶段名称
- `entries: Ref<ExecutionEntry[]>` — 实时追加的执行条目列表

每个 `ExecutionEntry` SHALL 包含：
- `timestamp: number` — 事件时间戳
- `event: ExecutionEvent` — 原始事件数据

#### Scenario: UI 组件订阅执行状态
- **WHEN** ExecutionPanel 组件 import `useExecutionMonitor()`
- **THEN** 组件 SHALL 获得与当前执行同步的响应式状态，状态变化自动触发渲染更新

#### Scenario: 多个组件同时订阅
- **WHEN** ExecutionPanel 和 ExecutionNotifier 同时调用 `useExecutionMonitor()`
- **THEN** 两者 SHALL 共享同一份响应式状态（模块级单例）

### Requirement: 侧边栏执行面板入口

左侧菜单 Tools 区 SHALL 新增"执行面板"工具项，ID 为 `__execution__`，与云盘资源、任务中心同级排列。

#### Scenario: 执行面板出现在工具列表
- **WHEN** 侧边栏渲染 Tools 区域
- **THEN** SHALL 显示执行面板项，使用 terminal 图标，标签为国际化翻译的"执行面板"

#### Scenario: 点击执行面板入口
- **WHEN** 用户点击侧边栏"执行面板"项
- **THEN** 右侧内容区 SHALL 展示 ExecutionPanel 组件，selectedPeer 变为 `__execution__`

### Requirement: ExecutionPanel 面板组件

系统 SHALL 提供 ExecutionPanel 组件，展示当前任务的实时 AI 执行输出。

面板 SHALL 包含：
- 顶部标题栏："执行面板"
- 任务信息区域（taskId + taskContent），仅在有执行任务时显示
- 执行阶段区域，按 stage 分组显示（Planner / Executor / Reviewer）
- 每个 stage 内按时间顺序展示完整的 reasoning 文本和工具调用详情
- 空状态提示："当前没有正在执行的任务"（status 为 idle 时）

#### Scenario: 无任务执行时的空状态
- **WHEN** 用户导航到执行面板且 `status === "idle"`
- **THEN** 面板 SHALL 显示空状态提示文字

#### Scenario: 任务执行中的实时展示
- **WHEN** 任务正在执行，Agent 产生 step:reasoning 和 step:tool_call 事件
- **THEN** 面板 SHALL 实时追加显示 reasoning 文本和工具调用信息，自动滚动到底部

#### Scenario: 任务执行完成
- **WHEN** 收到 pipeline:end 事件，status 变为 "done"
- **THEN** 面板 SHALL 显示最终结果（success/summary），状态清空后回到空状态

### Requirement: 右上角执行状态通知

系统 SHALL 提供 ExecutionNotifier 组件，在任务执行期间于右上角显示悬浮通知。

- 通知 SHALL 在 `status === "running"` 时出现，使用 scaleIn 动效入场
- 通知 SHALL 在 `status` 变为非 running 时淡出消失
- 通知 SHALL 显示当前执行阶段和步骤信息
- 点击通知 SHALL 将 selectedPeer 切换到 `__execution__`

#### Scenario: 任务开始执行时通知出现
- **WHEN** ExecutionMonitor 的 status 变为 "running"
- **THEN** 右上角 SHALL 出现悬浮通知，显示任务执行状态

#### Scenario: 点击通知跳转
- **WHEN** 用户点击执行通知
- **THEN** selectedPeer SHALL 切换为 `__execution__`，右侧展示 ExecutionPanel

#### Scenario: 任务完成后通知消失
- **WHEN** ExecutionMonitor 的 status 变为 "done" 或 "idle"
- **THEN** 悬浮通知 SHALL 淡出消失
