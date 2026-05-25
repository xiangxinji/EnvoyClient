## MODIFIED Requirements

### Requirement: Agent ReAct 循环引擎

系统 SHALL 在 Member 端实现 ReAct (Reason-Act-Observe) 循环。当 Member 收到 Leader 派发的任务时，Agent 引擎 SHALL 按以下流程执行：

1. 将任务内容作为初始 user message
2. 调用 Manager AI 推理端点获取下一步 action
3. 本地执行 AI 返回的 tool calls
4. 将 tool 执行结果拼入对话历史
5. 重复步骤 2-4 直到 AI 返回 `done` 或达到最大步数

`reactLoop()` SHALL 返回结构化对象 `{ result: string, trace: AgentStep[] }`，其中 `trace` 包含每步的 AI 推理文本、工具调用和执行结果。

`reactLoop()` SHALL 接受可选的 `onEvent` 回调参数。当 `onEvent` 存在时，SHALL 在以下时机调用：
- 每步 AI 推理完成后：调用 `onEvent({ type: "step:reasoning", stage, stepIndex, reasoning })`
- 每个工具调用前：调用 `onEvent({ type: "step:tool_call", stage, stepIndex, toolName, args })`
- 每个工具执行后：调用 `onEvent({ type: "step:tool_result", stage, stepIndex, toolName, result })`

当 `onEvent` 未传入时，SHALL 保持现有行为不变（向后兼容）。

#### Scenario: 简单任务单轮完成
- **WHEN** Member 收到任务 "查看当前目录文件列表"
- **THEN** Agent 调用 AI 获取 tool call `shell({ command: "ls" })`，本地执行后，AI 判断任务完成返回 `done`，返回的 trace 包含 1 个步骤（含推理文本、shell 调用和 stdout 结果）

#### Scenario: 复杂任务多轮迭代
- **WHEN** Member 收到任务 "检查磁盘使用，如果超过 80% 清理 tmp 目录"
- **THEN** Agent 经过多轮循环：先 `shell({ command: "df -h" })` 观察磁盘用量，再根据结果决定是否执行清理命令，最终返回 `done`，返回的 trace 包含所有步骤

#### Scenario: 达到最大步数强制结束
- **WHEN** Agent ReAct 循环执行到第 20 轮仍未收到 AI 的 `done` 信号
- **THEN** Agent SHALL 终止循环，返回的 trace 包含全部 20 个步骤，result 标记为 `max_steps_reached`

#### Scenario: AI 推理请求失败
- **WHEN** Agent 调用 Manager AI 端点返回非 200 状态码或网络超时
- **THEN** Agent SHALL 终止循环，返回 `{ result: JSON.stringify({ error }), trace: <已执行的步骤> }`

#### Scenario: reactLoop 调用 onEvent 回调
- **WHEN** reactLoop 执行第 3 步且传入了 onEvent 回调
- **THEN** SHALL 依次调用 onEvent({ type: "step:reasoning", ... }), onEvent({ type: "step:tool_call", ... }), onEvent({ type: "step:tool_result", ... })

#### Scenario: reactLoop 不传 onEvent 向后兼容
- **WHEN** reactLoop 执行且未传入 onEvent 参数
- **THEN** SHALL 不调用任何回调，行为与改造前完全一致

### Requirement: useAgent Composable

系统 SHALL 提供 `useAgent()` composable，封装完整的 ReAct Agent 逻辑。

`defineAgent` 的 `run` 方法 SHALL 接受可选的 `onEvent` 参数，透传给 `reactLoop`。当 `onEvent` 存在时，每个事件 SHALL 携带 `agent: agentName` 字段标识来源 agent。

#### Scenario: useAgent 初始化
- **WHEN** 组件调用 `useAgent()`
- **THEN** 返回 `{ runAgent, isRunning, currentStep, error }` 响应式属性和方法，`runAgent` 返回 `Promise<{ result: string, trace: AgentStep[] }>`

#### Scenario: reactLoop 在 doing 中被调用
- **WHEN** `useTeamClient` 的 `client.doing()` 收到任务
- **THEN** `doing` 处理器 SHALL 调用 `runAgent(taskContent)` 获取结构化返回值，将 `result` 作为任务结果提交，将 `trace` 作为 execution-trace 资源一并提交

#### Scenario: Agent 运行状态追踪
- **WHEN** ReAct 循环执行中
- **THEN** `isRunning` SHALL 为 `true`，`currentStep` SHALL 实时更新为当前步数（1-20）

#### Scenario: defineAgent 透传 onEvent
- **WHEN** defineAgent 的 run 方法收到 onEvent 回调
- **THEN** SHALL 将回调透传给 reactLoop，并在每个事件中注入 `agent: <agentName>` 字段

### Requirement: Agent 流水线事件通知

`definePipeline` SHALL 接受可选的 `onEvent` 回调参数，在以下时机调用：
- 流水线开始：`onEvent({ type: "pipeline:start", taskId, taskContent })`
- 阶段开始：`onEvent({ type: "stage:start", stage, attempt })`
- 阶段结束：`onEvent({ type: "stage:end", stage, result })`
- 流水线结束：`onEvent({ type: "pipeline:end", success, summary })`

`onEvent` SHALL 透传给每个 stage agent 的 `run` 方法，使 reactLoop 内部事件也能被外部接收。

#### Scenario: Pipeline 流水线事件通知
- **WHEN** pipeline.run() 开始执行 3 个阶段（planner → executor → reviewer）
- **THEN** SHALL 依次发出 pipeline:start, stage:start("planner"), (内部步骤事件...), stage:end("planner"), stage:start("executor"), (内部步骤事件...), stage:end("executor"), stage:start("reviewer"), (内部步骤事件...), stage:end("reviewer"), pipeline:end

#### Scenario: Pipeline 不传 onEvent 向后兼容
- **WHEN** pipeline.run() 未传入 onEvent 参数
- **THEN** SHALL 不调用任何回调，行为与改造前完全一致
