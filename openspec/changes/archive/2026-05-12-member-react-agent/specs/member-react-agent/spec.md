## ADDED Requirements

### Requirement: Agent ReAct 循环引擎

系统 SHALL 在 Member 端实现 ReAct (Reason-Act-Observe) 循环。当 Member 收到 Leader 派发的任务时，Agent 引擎 SHALL 按以下流程执行：

1. 将任务内容作为初始 user message
2. 调用 Manager AI 推理端点获取下一步 action
3. 本地执行 AI 返回的 tool calls
4. 将 tool 执行结果拼入对话历史
5. 重复步骤 2-4 直到 AI 返回 `done` 或达到最大步数

#### Scenario: 简单任务单轮完成
- **WHEN** Member 收到任务 "查看当前目录文件列表"
- **THEN** Agent 调用 AI 获取 tool call `shell({ command: "ls" })`，本地执行后，AI 判断任务完成返回 `done`，结果包含 stdout 内容

#### Scenario: 复杂任务多轮迭代
- **WHEN** Member 收到任务 "检查磁盘使用，如果超过 80% 清理 tmp 目录"
- **THEN** Agent 经过多轮循环：先 `shell({ command: "df -h" })` 观察磁盘用量，再根据结果决定是否执行清理命令，最终返回 `done`

#### Scenario: 达到最大步数强制结束
- **WHEN** Agent ReAct 循环执行到第 20 轮仍未收到 AI 的 `done` 信号
- **THEN** Agent SHALL 终止循环，将最后一轮的观察结果作为任务结果返回，并标记为 `max_steps_reached`

#### Scenario: AI 推理请求失败
- **WHEN** Agent 调用 Manager AI 端点返回非 200 状态码或网络超时
- **THEN** Agent SHALL 终止循环，返回错误信息 `{ error: "AI reasoning failed: <message>" }`

### Requirement: Member 端 Tool 定义体系

系统 SHALL 支持在 Member 端定义可扩展的 tool 集合。每个 tool SHALL 包含：
- `name`: string — tool 标识符
- `description`: string — tool 功能描述（传给 AI 模型）
- `parameters`: JSON Schema 对象 — tool 参数定义（传给 AI 模型）
- `execute`: async function — 本地执行实现（不传给 AI）

#### Scenario: 调用 Manager 时只传 tool schema
- **WHEN** Agent 向 Manager 发起推理请求
- **THEN** 请求体中的 `tools` 数组 SHALL 只包含 `name`、`description`、`parameters`，不包含 `execute` 函数

### Requirement: 内置 Shell Tool

系统 SHALL 提供 `shell` tool，允许 Agent 执行 shell 命令。

- name: `shell`
- parameters: `{ command: string }`
- execute: 调用 Tauri `shell_exec` invoke
- 返回: `{ stdout: string, stderr: string, exitCode: number }`

#### Scenario: Shell 命令执行成功
- **WHEN** AI 返回 tool call `shell({ command: "echo hello" })`
- **THEN** Agent 调用 `invoke("shell_exec", { command: "echo hello" })`，将 `{ stdout: "hello\n", stderr: "", exitCode: 0 }` 作为 tool result 拼入对话历史

#### Scenario: Shell 命令执行失败
- **WHEN** AI 返回 tool call `shell({ command: "invalid_cmd" })` 且执行返回非零 exitCode
- **THEN** Agent SHALL 将完整的 `{ stdout, stderr, exitCode }` 返回给 AI，由 AI 决定是否重试或换策略

### Requirement: 内置 File Read Tool

系统 SHALL 提供 `file_read` tool，允许 Agent 读取本地文件内容。

- name: `file_read`
- parameters: `{ path: string }`
- execute: 调用 Tauri `file_read` invoke
- 返回: `{ content: string }`

#### Scenario: 读取存在的文件
- **WHEN** AI 返回 tool call `file_read({ path: "~/project/package.json" })`
- **THEN** Agent 调用 Tauri file_read，返回文件内容字符串

#### Scenario: 读取不存在的文件
- **WHEN** AI 返回 tool call `file_read({ path: "~/nonexistent.txt" })` 且文件不存在
- **THEN** Agent SHALL 返回 `{ error: "File not found" }` 给 AI

### Requirement: 内置 File Write Tool

系统 SHALL 提供 `file_write` tool，允许 Agent 写入本地文件。

- name: `file_write`
- parameters: `{ path: string, content: string }`
- execute: 调用 Tauri `file_write` invoke
- 返回: `{ success: boolean }`

#### Scenario: 写入文件成功
- **WHEN** AI 返回 tool call `file_write({ path: "~/output.txt", content: "result" })`
- **THEN** Agent 调用 Tauri file_write，返回 `{ success: true }`

#### Scenario: 写入路径在 home 目录外
- **WHEN** AI 返回 tool call `file_write({ path: "/etc/passwd", content: "..." })`
- **THEN** Tauri 端 SHALL 拒绝操作，Agent 返回 `{ error: "Path outside allowed directory" }`

### Requirement: 内置 Done Tool

系统 SHALL 提供 `done` tool，允许 Agent 声明任务完成。

- name: `done`
- parameters: `{ result: string }`
- 返回: 触发循环结束

#### Scenario: Agent 主动完成任务
- **WHEN** AI 返回 tool call `done({ result: "磁盘使用率 45%，无需清理" })`
- **THEN** Agent SHALL 终止循环，将 `result` 字段内容作为最终任务结果返回

### Requirement: useAgent Composable

系统 SHALL 提供 `useAgent()` composable，封装完整的 ReAct Agent 逻辑。

#### Scenario: useAgent 初始化
- **WHEN** 组件调用 `useAgent()`
- **THEN** 返回 `{ reactLoop, isRunning, currentStep, error }` 响应式属性和方法

#### Scenario: reactLoop 在 doing 中被调用
- **WHEN** `useTeamClient` 的 `client.doing()` 收到任务
- **THEN** `doing` 处理器 SHALL 调用 `reactLoop(taskContent)` 并将其返回值作为任务结果提交

#### Scenario: Agent 运行状态追踪
- **WHEN** ReAct 循环执行中
- **THEN** `isRunning` SHALL 为 `true`，`currentStep` SHALL 实时更新为当前步数（1-20）

### Requirement: 单轮超时保护

系统 SHALL 对 ReAct 循环中的每个阶段设置超时：
- AI 推理请求：30 秒
- Tool 执行：60 秒

#### Scenario: AI 推理超时
- **WHEN** POST `/api/ai/agent/reason` 在 30 秒内未返回
- **THEN** Agent SHALL 终止循环，返回 `{ error: "AI reasoning timeout" }`

#### Scenario: Tool 执行超时
- **WHEN** tool execute 函数在 60 秒内未完成
- **THEN** Agent SHALL 终止当前 tool，返回 `{ error: "Tool execution timeout" }` 给 AI，由 AI 决定下一步
