## Why

当前任务执行完成后存在数据丢失风险：Client 侧通过 `void taskService.submitResult()` fire-and-forget 提交结果，网络异常时结果静默丢失；Server 侧任务调度状态（`serialIndex`、`pendingClients`、`leaderReviewing`、`retryCount`）仅存在于内存 `Map` 中，进程重启后无法恢复运行中的任务。

## What Changes

- Client 侧 pipeline 完成后，先将结果写入本地 outbox 文件（`~/.envoy/outbox/{team}/{taskId}.json`），再 `await` HTTP 提交 + 指数退避重试（3 次），成功后删除 outbox 文件
- Client 启动和 WebSocket 重连时扫描 outbox 目录，重发未提交的结果
- browser mode 降级为纯 `await` + 重试（无本地文件）
- Server `tasks` 表新增 `serial_index`、`pending_clients`、`leader_reviewing`、`retry_count` 四列，持久化完整调度状态
- Server 新增 `getTaskState(taskId)` getter，`setupTaskPersistence` 监听器通过该 getter 获取调度状态一并写入 SQLite
- Manager `restoreTeams()` 启动时从 SQLite 查询活跃任务（`status NOT IN ('completed','failed')`），重建 `TaskState` 加载到 Server 内存 Map，按状态重新 dispatch

## Capabilities

### New Capabilities
- `task-result-outbox`: Client 侧任务结果本地暂存与可靠提交，保证 pipeline 执行结果零丢失
- `task-state-recovery`: Server 侧任务调度状态的持久化与重启恢复，支持运行中任务继续执行

### Modified Capabilities
- `message-persistence`: `persistTask()` 和 `upsertTask()` 扩展以包含调度状态字段
- `client-rest-messaging`: `taskService.submitResult()` 从 fire-and-forget 改为 await + outbox 模式

## Impact

- **envoy/packages/server/server.ts**: 新增 `getTaskState()` getter、`loadTaskState()` 方法用于恢复
- **envoy/packages/core/task.ts**: `TaskState` 接口需导出或新增序列化类型
- **manager/server/db.ts**: `upsertTask()` 扩展参数，新增 migration，新增 `queryActiveTasks()`
- **manager/server/index.ts**: `persistTask()` 扩展，`restoreTeams()` 新增任务恢复逻辑
- **src/composables/useTaskExecution.ts**: 替换 `void` 为 outbox 提交流程
- **src/services/TaskService.ts**: `submitResult()` 改为支持重试
- **新增 outbox 管理模块**: 文件读写、扫描、清理逻辑（复用 Tauri invoke 或 Node fs）
