## Why

当前任务结果提交存在**4 条独立路径**，导致结果可能被重复提交或静默丢失：

1. **Client autoSendResult** — `doing` handler 返回后，Client 自动通过 WebSocket 发送 `result` 消息
2. **REST /result** — `useTaskCenterExecution` 通过 `outbox` + `submitWithRetry` 调用 `taskService.submitResult`
3. **REST /complete** — TaskCard 操作按钮调用 `taskService.complete` → `manualCompleteTask`
4. **Leader review** — Leader 评审走 REST /result 路径，但 payload 结构不同

同时 ClientTask 和 ServerTask 拥有**同名但含义不同的状态枚举**（pending/running/completed/failed），代码中需要反复推断"这个 running 是哪一层的"。`ClientTask.status` 字段实际无人消费，是冗余状态。

## What Changes

### 维度一：统一提交通道

- **关闭 `autoSendResult`** — 桥接模式下所有提交统一走 outbox + REST `/result` 路径
- **废弃 REST `/complete` 端点** — 所有完成（手动/自动/超时）统一通过 outbox 写入 + REST `/result` 提交
- **统一 resolve payload 结构** — `resolveCurrentTask()` 接收 `TaskResolution` 对象，统一 success/source/data/error 格式
- **outbox 防重复** — outbox 文件包含唯一提交 ID，Server 端幂等检查

### 维度二：简化 ClientTask 状态

- **移除 `ClientTask.status` 字段** — 状态由队列位置决定：`client.running === this` = 执行中，`client.queue.includes(this)` = 排队中，`completedAt !== undefined` = 已结束
- **分离超时与正常完成** — 超时时 `error` 字段设置，`status` 标记为 `failed` 而非 `completed`
- **`pendingResolve` 改用 Map** — 以 taskId 为 key，消除"单变量被覆盖"的隐患
- **30 分钟超时改为可配置** — 通过 `settings.task_execution_timeout_ms` 控制

### Non-Goals

- 不修改 Server 端 `processResult` 内部逻辑（只改调用方，不改 Server）
- 不修改 Envoy 框架的 `Client.processNext()` 核心调度逻辑
- 不改变 Leader reviewing 流程
- 不修改 REST `/dispatch` 或 Server `submitFrom` 等提交入口

## Capabilities

### New Capabilities
- `task-resolution-payload`: 统一的 TaskResolution 结构定义，所有 resolveCurrentTask 调用使用相同格式
- `configurable-task-timeout`: 任务执行超时可配置，支持 UI 中止操作

### Modified Capabilities
- `client-task-queue-bridge`: 关闭 autoSendResult，ClientTask 移除 status 字段改用队列位置推断，pendingResolve 改用 Map，超时标记为 failed
- `task-manual-operations`: 移除 REST /complete 端点和 manualCompleteTask 调用，所有操作统一到 TaskResolution + outbox 提交
- `task-state-recovery`: outbox 增加唯一提交 ID，Server 端幂等处理重复提交

## Impact

- `envoy/packages/client/client.ts` — 移除 status 字段，pendingResolve Map 化，autoSendResult 默认关闭
- `src/composables/useTaskExecution.ts` — pendingResolve Map，timeout 标记 failed，可配置超时
- `src/composables/useTaskCenterExecution.ts` — 统一 TaskResolution，移除手动路径分支
- `src/services/TaskService.ts` — 移除 complete() 方法
- `src/components/TaskCard/main.vue` — 移除手动完成调用
- `src/views/TaskCenterView/main.vue` — 统一 resolve 调用格式
- `src/types.ts` — 新增 TaskResolution 类型
- `manager/server/routes/messages.ts` — 移除 /complete 端点
- `envoy/packages/server/server.ts` — 移除 manualCompleteTask 方法（可选，取决于是否保留 REST 端点）
