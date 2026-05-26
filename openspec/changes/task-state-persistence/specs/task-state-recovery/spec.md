## ADDED Requirements

### Requirement: Server 暴露 getTaskState getter
Envoy Server SHALL 提供 `getTaskState(taskId)` 方法，返回指定任务的调度状态快照（plain object），包含 `serialIndex`、`pendingClients`（Array）、`leaderReviewing`、`retryCount`。任务不存在时返回 `null`。

#### Scenario: 获取存在的任务状态
- **WHEN** 调用 `server.getTaskState("task-123")`，该任务存在于内存 Map 中
- **THEN** 返回 `{ serialIndex: 2, pendingClients: ["member1"], leaderReviewing: false, retryCount: 0 }`

#### Scenario: 获取不存在的任务状态
- **WHEN** 调用 `server.getTaskState("nonexistent")`
- **THEN** 返回 `null`

### Requirement: Server 暴露 loadTaskStates 方法
Envoy Server SHALL 提供 `loadTaskStates(entries: Array<{task: Task, state: SerializedTaskState}>)` 方法，批量将恢复的任务加载到内存 Map 中。

#### Scenario: 批量加载任务状态
- **WHEN** 调用 `server.loadTaskStates([{task, state}])`
- **THEN** 每个 entry 被构造为 `TaskState` 对象（`pendingClients` 从 Array 转为 Set），存入 `Server.tasks` Map

#### Scenario: 加载已存在的任务
- **WHEN** 加载的 taskId 已存在于内存 Map 中
- **THEN** 跳过该条目，不覆盖现有状态

### Requirement: SQLite tasks 表扩展调度状态列
`tasks` 表 SHALL 新增四列：`serial_index INTEGER DEFAULT 0`、`pending_clients TEXT DEFAULT '[]'`、`leader_reviewing INTEGER DEFAULT 0`、`retry_count INTEGER DEFAULT 0`。

#### Scenario: 新建数据库
- **WHEN** 首次创建 tasks 表
- **THEN** 表包含 id, create_by, subscribe, content, mode, status, resources, created_at, attempt, updated_at, serial_index, pending_clients, leader_reviewing, retry_count 全部列

#### Scenario: 已有数据库迁移
- **WHEN** 数据库中 tasks 表已存在但缺少新列
- **THEN** 通过 `ALTER TABLE ADD COLUMN` 添加四列，已有行的值为默认值

### Requirement: upsertTask 包含调度状态
`upsertTask()` 函数 SHALL 接受可选的调度状态参数，将其写入对应的四列。未提供时使用默认值。

#### Scenario: 带 TaskState 的 upsert
- **WHEN** 调用 `upsertTask(teamName, task, { serialIndex: 1, pendingClients: ["m1", "m2"], leaderReviewing: false, retryCount: 0 })`
- **THEN** SQLite 行的 serial_index=1, pending_clients='["m1","m2"]', leader_reviewing=0, retry_count=0

#### Scenario: 不带 TaskState 的 upsert
- **WHEN** 调用 `upsertTask(teamName, task)` 不提供第三参数
- **THEN** SQLite 行的调度状态列为默认值（0, '[]', 0, 0）

### Requirement: persistTask 持久化调度状态
`persistTask()` 函数 SHALL 在持久化任务时，通过 `server.getTaskState()` 获取调度状态，一并写入 SQLite。

#### Scenario: 有调度状态的任务更新
- **WHEN** `task:updated` 事件触发，任务处于 running 状态
- **THEN** `persistTask()` 调用 `server.getTaskState(task.id)`，将返回的 state 传给 `upsertTask()`

#### Scenario: 任务已完成无调度状态
- **WHEN** `task:completed` 事件触发
- **THEN** `getTaskState()` 返回最终状态，`upsertTask()` 正常写入

### Requirement: 启动时恢复活跃任务
Manager `restoreTeams()` SHALL 在创建 Team+Server 后，从 SQLite 查询活跃任务并恢复到 Server 内存中。

#### Scenario: 有活跃任务需要恢复
- **WHEN** Manager 启动，SQLite 中存在 status 为 'pending'、'running' 或 'reviewing' 的任务
- **THEN** 系统读取这些任务行，重建 TaskState 对象，调用 `server.loadTaskStates()` 加载到内存

#### Scenario: 无活跃任务
- **WHEN** Manager 启动，SQLite 中所有任务均为 'completed' 或 'failed'
- **THEN** 不执行恢复操作

### Requirement: 恢复后重新 dispatch
活跃任务恢复到内存后，系统 SHALL 根据任务状态重新 dispatch。

#### Scenario: 恢复 pending 任务
- **WHEN** 恢复的任务 status 为 'pending'
- **THEN** 根据 mode 调用 `server` 的 dispatchSerial 或 dispatchParallel（通过重新触发 submitFrom 语义或直接调用内部 dispatch）

#### Scenario: 恢复 running 任务
- **WHEN** 恢复的任务 status 为 'running'
- **THEN** 仅向 `pending_clients` 中的在线成员发送 dispatch 消息

#### Scenario: 恢复 reviewing 任务
- **WHEN** 恢复的任务 status 为 'reviewing'
- **THEN** 向 leader 发送 dispatch 消息以重新触发 leader review

#### Scenario: 目标成员不在线
- **WHEN** 恢复后 dispatch 目标成员不在线
- **THEN** Server 现有的 `reassignPendingTasks` 逻辑会在成员重连时自动 dispatch
