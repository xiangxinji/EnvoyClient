## MODIFIED Requirements

### Requirement: Agent ReAct 循环引擎

系统 SHALL 在 Member 端实现 ReAct (Reason-Act-Observe) 循环。当 Member 收到 Leader 派发的任务时，Agent 引擎 SHALL 按以下流程执行：

1. 将任务内容作为初始 user message
2. 调用 Manager AI 推理端点获取下一步 action
3. 本地执行 AI 返回的 tool calls
4. 将 tool 执行结果拼入对话历史
5. 重复步骤 2-4 直到 AI 返回 `done` 或达到最大步数

`reactLoop()` SHALL 返回结构化对象 `{ result: string, trace: AgentStep[] }`，其中 `trace` 包含每步的 AI 推理文本、工具调用和执行结果。

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

### Requirement: useAgent Composable

系统 SHALL 提供 `useAgent()` composable，封装完整的 ReAct Agent 逻辑。

#### Scenario: useAgent 初始化
- **WHEN** 组件调用 `useAgent()`
- **THEN** 返回 `{ runAgent, isRunning, currentStep, error }` 响应式属性和方法，`runAgent` 返回 `Promise<{ result: string, trace: AgentStep[] }>`

#### Scenario: reactLoop 在 doing 中被调用
- **WHEN** `useTeamClient` 的 `client.doing()` 收到任务
- **THEN** `doing` 处理器 SHALL 调用 `runAgent(taskContent)` 获取结构化返回值，将 `result` 作为任务结果提交，将 `trace` 作为 execution-trace 资源一并提交

#### Scenario: Agent 运行状态追踪
- **WHEN** ReAct 循环执行中
- **THEN** `isRunning` SHALL 为 `true`，`currentStep` SHALL 实时更新为当前步数（1-20）

## ADDED Requirements

### Requirement: AgentStep 类型定义

系统 SHALL 定义 `AgentStep` 类型用于描述 ReAct 循环的每个步骤：
- `index: number` — 步骤序号（从 1 开始）
- `reasoning: string` — AI 的推理文本
- `toolCalls: Array<{ name: string, args: any }>` — 工具调用列表
- `toolResults: Array<{ name: string, result: any }>` — 工具执行结果列表

#### Scenario: 包含工具调用的步骤
- **WHEN** Agent 在某步执行了 `shell({ command: "ls" })`
- **THEN** 对应 AgentStep 的 `toolCalls` 包含 `{ name: "shell", args: { command: "ls" } }`，`toolResults` 包含执行结果

#### Scenario: 无工具调用的步骤（仅推理）
- **WHEN** AI 返回纯文本无 tool calls
- **THEN** 对应 AgentStep 的 `toolCalls` 和 `toolResults` 为空数组，`reasoning` 包含 AI 文本

### Requirement: 执行 trace 提交

`POST /api/tasks/:id/result` 端点 SHALL 扩展接受 `trace` 字段（AgentStep 数组）和 `uploadedFiles` 字段（上传文件信息列表）。Manager 收到后 SHALL 将 trace 作为 `execution-trace` 类型资源、文件信息作为 `file-resource` 类型资源添加到 `task.resources[]`。

#### Scenario: Member 提交包含 trace 的结果
- **WHEN** Member POST `{ from, success: true, data, trace: [AgentStep, ...] }`
- **THEN** Manager SHALL 将 trace 添加为 `task.resources[]` 中的 `{ type: "execution-trace", by: from, data: { steps: trace } }`

#### Scenario: Member 提交不包含 trace（向后兼容）
- **WHEN** Member POST `{ from, success: true, data }`（无 trace 字段）
- **THEN** Manager SHALL 仅处理 result，不添加 execution-trace 资源

### Requirement: 文件上传时登记 file-resource

`POST /api/tasks/:id/resources` 端点 SHALL 在文件上传成功后，向对应 task 的 `resources[]` 添加一条 `{ type: "file-resource", by: from, data: { filename, size, uploadedAt } }` 记录，并通过 `notifyTaskUpdate()` 通知所有订阅者。

#### Scenario: 上传文件成功
- **WHEN** Member 通过 `POST /api/tasks/:id/resources` 上传 `报告.pdf`（10240 字节）
- **THEN** Manager SHALL 将文件写入磁盘，同时在 `task.resources[]` 添加 `{ type: "file-resource", by: memberId, data: { filename: "报告.pdf", size: 10240, uploadedAt: <timestamp> } }`

#### Scenario: 上传文件失败
- **WHEN** 文件写入磁盘失败
- **THEN** Manager SHALL 返回错误，不添加 file-resource 记录
