## MODIFIED Requirements

### Requirement: Agent ReAct 循环引擎

系统 SHALL 在 Member 端实现 ReAct (Reason-Act-Observe) 循环。当 Member 收到 Leader 派发的任务时，SHALL 根据当前任务执行模式决定行为：

1. **auto 模式**（默认）：收到任务后自动启动 Agent ReAct 循环
2. **manual 模式**：收到任务后仅更新任务列表状态为 pending，不启动 Agent

ReAct 循环流程：
1. 将任务内容作为初始 user message
2. 调用 Manager AI 推理端点获取下一步 action
3. 本地执行 AI 返回的 tool calls
4. 将 tool 执行结果拼入对话历史
5. 重复步骤 2-4 直到 AI 返回 `done` 或达到最大步数

#### Scenario: 简单任务单轮完成
- **WHEN** Member 收到任务 "查看当前目录文件列表" 且处于 auto 模式
- **THEN** Agent 调用 AI 获取 tool call `shell({ command: "ls" })`，本地执行后，AI 判断任务完成返回 `done`，结果包含 stdout 内容

#### Scenario: manual 模式下收到任务
- **WHEN** Member 的 task_execution_mode 为 `manual` 且收到新任务
- **THEN** doing handler 仅更新任务列表状态为 pending，不启动 Agent 循环，等待用户在任务中心手动操作

#### Scenario: 复杂任务多轮迭代
- **WHEN** Member 收到任务 "检查磁盘使用，如果超过 80% 清理 tmp 目录" 且处于 auto 模式
- **THEN** Agent 经过多轮循环：先 `shell({ command: "df -h" })` 观察磁盘用量，再根据结果决定是否执行清理命令，最终返回 `done`

#### Scenario: 达到最大步数强制结束
- **WHEN** Agent ReAct 循环执行到第 20 轮仍未收到 AI 的 `done` 信号
- **THEN** Agent SHALL 终止循环，将最后一轮的观察结果作为任务结果返回，并标记为 `max_steps_reached`

#### Scenario: AI 推理请求失败
- **WHEN** Agent 调用 Manager AI 端点返回非 200 状态码或网络超时
- **THEN** Agent SHALL 终止循环，返回错误信息 `{ error: "AI reasoning failed: <message>" }`
