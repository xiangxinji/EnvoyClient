## MODIFIED Requirements

### Requirement: useAgent Composable
系统 SHALL 提供 `useAgent()` composable，封装完整的 ReAct Agent 逻辑。`useAgent` SHALL 不再在 `doing` handler 中被直接调用，而是由任务中心根据执行模式触发。

#### Scenario: useAgent 初始化
- **WHEN** 组件调用 `useAgent()`
- **THEN** 返回 `{ runAgent, isRunning, currentStep, error }` 响应式属性和方法，`runAgent` 返回 `Promise<{ result: string, trace: AgentStep[] }>`

#### Scenario: Auto 模式下任务中心自动触发 Agent
- **WHEN** `currentClientTask` 更新为新的 ClientTask，且 `task_execution_mode` 为 "auto"
- **THEN** 任务中心 SHALL 自动调用 `runAgent(taskContent)`，将结果传给 `resolveCurrentTask`

#### Scenario: Manual 模式下等待用户触发
- **WHEN** `currentClientTask` 更新为新的 ClientTask，且 `task_execution_mode` 为 "manual"
- **THEN** 任务中心 SHALL 显示任务信息和"执行"按钮，等待用户点击后再调用 `runAgent(taskContent)`

#### Scenario: Agent 运行状态追踪
- **WHEN** ReAct 循环执行中
- **THEN** `isRunning` SHALL 为 `true`，`currentStep` SHALL 实时更新为当前步数（1-20）

## ADDED Requirements

### Requirement: 任务中心执行 composable
系统 SHALL 提供任务中心专用的执行 composable（如 `useTaskCenterExecution`），封装从 `currentClientTask` 到 pipeline 执行再到 `resolveCurrentTask` 的完整流程。

#### Scenario: Auto 模式执行流程
- **WHEN** `currentClientTask` 变化且 mode 为 auto
- **THEN** composable SHALL 自动调用 `taskService.start(taskId)`，执行 pipeline，收集结果，调用 `resolveCurrentTask(result)`

#### Scenario: Manual 模式执行流程
- **WHEN** `currentClientTask` 变化且 mode 为 manual
- **THEN** composable SHALL 暴露 `executeCurrentTask()` 方法，用户点击"执行"后调用，执行 pipeline 并 `resolveCurrentTask`

#### Scenario: 执行完成后的结果提交
- **WHEN** pipeline 执行完成
- **THEN** composable SHALL 将结果写入 outbox，通过 `taskService.submitResult` 提交，成功后删除 outbox 条目
