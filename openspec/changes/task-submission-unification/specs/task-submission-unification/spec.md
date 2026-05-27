## ADDED Requirements

### Requirement: Unified TaskResolution Payload
所有任务完成路径（手动、AI执行、超时、中止）SHALL 使用统一的 `TaskResolution` 结构调用 `resolveCurrentTask()`。该结构 MUST 包含 `success: boolean`、`source: "manual" | "ai" | "timeout" | "aborted"`、可选 `data`、可选 `error`、可选 `trace`。

#### Scenario: 手动完成任务
- **WHEN** 用户在 TaskCard 点击"完成"按钮
- **THEN** 调用 `resolveCurrentTask({ success: true, source: "manual", data: { ... } })`

#### Scenario: AI 执行完成
- **WHEN** pipeline.run() 完成
- **THEN** 调用 `resolveCurrentTask({ success: true, source: "ai", data: parsed, trace: allTraces })`

#### Scenario: 执行超时
- **WHEN** 任务执行超过配置的超时时间
- **THEN** 调用 `resolveCurrentTask({ success: false, source: "timeout", error: "execution_timeout" })`

#### Scenario: 用户中止
- **WHEN** 用户点击"中止任务"按钮
- **THEN** 调用 `resolveCurrentTask({ success: false, source: "aborted", error: "User aborted" })`

### Requirement: Single Submission Channel
桥接模式下 SHALL 关闭 `autoSendResult`，所有任务结果提交 MUST 统一通过 outbox + REST `/result` 路径。

#### Scenario: 正常提交
- **WHEN** resolveCurrentTask 被调用
- **THEN** 先 writeOutbox，再异步 submitWithRetry，最后释放 doing handler Promise

#### Scenario: 提交失败
- **WHEN** submitWithRetry 3 次重试后仍失败
- **THEN** outbox 文件保留，等待重连时 flushOutbox 重新提交

#### Scenario: 重连恢复
- **WHEN** 客户端重连触发 flushOutbox
- **THEN** 所有 outbox 文件被重新提交，成功后删除

### Requirement: Outbox Deduplication
OutboxEntry SHALL 包含唯一 `id` 字段，Server `/result` 端点 SHALL 对相同 outboxId 的提交做幂等处理。

#### Scenario: 首次提交
- **WHEN** `/result` 端点收到带 outboxId 的请求
- **THEN** 检查 task resources 中是否已有相同 outboxId，没有则正常处理

#### Scenario: 重复提交
- **WHEN** `/result` 端点收到已处理的 outboxId
- **THEN** 返回成功但不追加 resource

### Requirement: Configurable Task Timeout
任务执行超时 SHALL 可通过 `settings.task_execution_timeout_ms` 配置，默认值 MUST 为 600000ms (10 分钟)。

#### Scenario: 使用默认超时
- **WHEN** settings 未配置 task_execution_timeout_ms
- **THEN** 使用 600000ms (10 分钟) 作为超时时间

#### Scenario: 自定义超时
- **WHEN** settings 配置了 task_execution_timeout_ms
- **THEN** 使用该值作为超时时间

### Requirement: ClientTask Status Inferred from Queue Position
ClientTask SHALL 不再包含独立 `status` 字段，任务状态 MUST 由队列位置和时间戳推断。

#### Scenario: 执行中判断
- **WHEN** `client.currentTask?.id === task.id`
- **THEN** 该任务视为执行中

#### Scenario: 排队中判断
- **WHEN** `client.taskQueue.some(t => t.id === task.id)`
- **THEN** 该任务视为排队等待

#### Scenario: 完成/失败判断
- **WHEN** `task.completedAt !== undefined`
- **THEN** 该任务已结束；`task.error !== undefined` 时为失败，否则为成功

### Requirement: Timeout Triggers Failed Path
超时 SHALL 通过哨兵值触发 `task_failed` 事件，而非 `task_completed`。

#### Scenario: 超时处理
- **WHEN** 超时定时器触发
- **THEN** resolve 哨兵值，processNext 检测到哨兵后走 failed 逻辑

## MODIFIED Requirements

### Requirement: task-manual-operations
REST `/complete` 端点、`Server.manualCompleteTask` 方法和 `TaskService.complete()` SHALL 被移除。所有手动操作 MUST 通过 `resolveCurrentTask` 统一处理。

#### Scenario: 用户点击完成
- **WHEN** TaskCard 上点击"完成"
- **THEN** emit `task-resolved` 事件，TaskCenter 调用 `resolveCurrentTask({ success: true, source: "manual" })`

#### Scenario: /complete 端点被调用
- **WHEN** 外部请求 POST `/api/tasks/:id/complete`
- **THEN** 返回 404 Not Found

## REMOVED Requirements

### Requirement: autoSendResult in Bridge Mode
桥接模式不再需要 `autoSendResult` 选项，因为 outbox 机制完全覆盖了其功能。

### Requirement: manualCompleteTask Server Method
Server 不再需要 `manualCompleteTask` 方法，因为客户端统一通过 `/result` 提交。
