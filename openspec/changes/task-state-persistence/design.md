## Context

Envoy 任务系统分为三层：Client（Vue/Tauri 执行 pipeline）、Manager（Hono HTTP + Envoy Server 调度）、Envoy Server（WebSocket 中转 + 状态机）。

当前数据流：

```
Client pipeline 完成 → void taskService.submitResult() → HTTP POST /api/tasks/:id/result
                                                              → Server.receiveResult() → processResult()
                                                              → finishTask() → emit("task:completed")
                                                              → persistTask() → upsertTask() SQLite
```

三个断点：
1. HTTP POST 失败时 `void` 吞掉错误，结果丢失
2. Server.tasks Map 纯内存，重启清空
3. SQLite 只存 Task 字段，不存 TaskState 调度字段（serialIndex, pendingClients, leaderReviewing, retryCount）

## Goals / Non-Goals

**Goals:**
- Pipeline 执行结果零丢失，无论网络抖动还是进程崩溃
- Server 重启后活跃任务可恢复并继续执行
- 最小化对现有 envoy 框架代码的侵入

**Non-Goals:**
- 不改 Envoy Server 的事件签名（EventEmitter 接口不变）
- 不引入新的外部依赖（Redis、MQ 等）
- 不处理已 completed/failed 的历史任务恢复
- 不改 Client 的 autoSendResult: false 策略

## Decisions

### D1: Client outbox 使用 Tauri 文件系统

**选择**: `~/.envoy/outbox/{team}/{taskId}.json`

**替代方案**:
- localStorage：容量限制（~5MB），浏览器环境下才可用，不够可靠
- IndexedDB：过于复杂，大材小用

**理由**: Tauri 桌面端为主场景，文件系统最可靠。browser mode 降级为纯内存重试。

### D2: Server 暴露 getTaskState() getter

**选择**: Server 新增 `getTaskState(taskId)` 返回 TaskState 快照（plain object）

**替代方案**:
- 改事件签名 emit("task:updated", task, state) — 侵入 EventEmitter 接口
- persistTask 主动从 server 查 — 耦合方向反了

**理由**: getter 最小侵入，不改现有事件签名，Manager 层按需查询。返回的是序列化友好的 plain object（`pendingClients` 从 Set 转为 Array）。

### D3: SQLite 扩展 tasks 表而非新建表

**选择**: 在现有 tasks 表加列（serial_index, pending_clients, leader_reviewing, retry_count）

**替代方案**:
- 新建 task_states 表 — 需要跨表 JOIN，维护成本高
- JSON 文件存储 — 查询不便，与现有 SQLite 基础设施不一致

**理由**: 一张表最简单，upsert 逻辑不需要跨表事务。用 `ALTER TABLE ADD COLUMN` 迁移，已有数据自动获得默认值。

### D4: 恢复时按状态重新 dispatch

**选择**: 重启后根据任务状态决定 dispatch 策略
- `pending` → 调用 dispatchSerial/dispatchParallel 从头开始
- `running` → 仅 dispatch 给 pending_clients 中的成员
- `reviewing` → dispatch 给 leader

**理由**: 最接近中断前的状态继续执行，避免重复已完成的工作。

### D5: Server 新增 loadTaskStates() 方法

**选择**: 新增 `loadTaskStates(entries: Array<{task: Task, state: SerializedTaskState}>)` 方法，批量加载恢复的任务到内存 Map

**理由**: 恢复是一次性操作，批量加载比分次调用更清晰。恢复完成后由调用方触发 dispatch。

## Risks / Trade-offs

**[重复 dispatch]** → Member 可能收到重复的 dispatch 消息。Client 已有去重逻辑（`handleDispatch` 检查 `queued` 和 `running`），所以无实际影响。

**[outbox 文件累积]** → 如果 Server 长期不可用，outbox 文件会累积。设置上限（如最多 100 个文件），超出时 log warning。实际场景中 Server 通常同机部署，风险极低。

**[TaskState 一致性窗口]** → TaskState 的内存 → SQLite 写入是异步的（事件监听器），极端情况下进程崩溃可能在两次事件之间丢失中间状态。影响：重启后任务可能回退到上一个已持久化的状态，而非崩溃时的精确状态。缓解：`notifyTaskUpdate` 在每个关键操作后被调用，频率足够高。

**[migration]** → ALTER TABLE ADD COLUMN 在 better-sqlite3 中是即时操作，不影响已有数据。默认值确保旧数据兼容。
