## MODIFIED Requirements

### Requirement: Client uses REST API for sendChat
`useTeamClient.ts` 的 `sendChat` 函数 SHALL 使用 `fetch POST /api/messages` 替代 `client.sendTo()`。请求 SHALL 携带 `team` header 和 `Content-Type: application/json`。本地消息仍通过 `addToConversation` 添加到 UI 和 Tauri IPC 存储。

#### Scenario: Send chat message via REST
- **WHEN** 用户发送聊天消息，调用 `sendChat("member1", "hello")`
- **THEN** 前端通过 POST /api/messages 发送请求，本地 UI 立即显示消息（乐观更新），消息通过 Tauri IPC 保存到本地历史

### Requirement: Client uses REST API for dispatchTask
`useTeamClient.ts` 的 `dispatchTask` 函数 SHALL 使用 `fetch POST /api/tasks` 替代 `client.submit()`。请求 SHALL 携带 `team` header。

#### Scenario: Dispatch task via REST
- **WHEN** Leader 派发任务，调用 `dispatchTask(["member1"], "do something")`
- **THEN** 前端通过 POST /api/tasks 发送请求，Member 通过 WS 收到 dispatch 并进入 doing 处理

### Requirement: Client uses REST API for task result submission
`useTaskExecution.ts` 的 `taskService.submitResult()` 调用 SHALL 从 fire-and-forget (`void`) 改为 `await` + outbox 模式。Pipeline 完成后先写 outbox 文件，再 await 提交，成功后删除 outbox 文件。

#### Scenario: Submit result with outbox
- **WHEN** pipeline 完成，调用 `submitResult(taskId, result)`
- **THEN** 系统先写 outbox 文件到 `~/.envoy/outbox/{team}/{taskId}.json`，再 await HTTP POST，成功后删除 outbox 文件

#### Scenario: Submit result fails
- **WHEN** HTTP POST 失败
- **THEN** 系统保留 outbox 文件，不阻塞任务队列，下次启动或重连时重发
