## 1. Server 调度状态暴露

- [x] 1.1 在 `envoy/packages/server/server.ts` 新增 `getTaskState(taskId)` 方法，返回 `{ serialIndex, pendingClients: string[], leaderReviewing, retryCount }` 或 `null`（pendingClients 从 Set 转为 Array）
- [x] 1.2 在 `envoy/packages/server/server.ts` 新增 `loadTaskStates(entries)` 方法，将恢复的任务批量加载到 `tasks` Map（pendingClients 从 Array 转为 Set，跳过已存在的 taskId）
- [x] 1.3 在 `envoy/packages/core/task.ts` 新增 `SerializedTaskState` 接口导出，供 Manager 和 Server 间传递序列化状态

## 2. SQLite Schema 扩展

- [x] 2.1 在 `manager/server/db.ts` 的 `CREATE_TASKS_TABLE` 中添加 `serial_index`、`pending_clients`、`leader_reviewing`、`retry_count` 四列
- [x] 2.2 在 `initTeamDatabase()` 中添加迁移逻辑，对已有数据库 `ALTER TABLE ADD COLUMN` 添加缺失的列
- [x] 2.3 扩展 `upsertTask()` 签名，接受可选的第三参数 `SerializedTaskState`，INSERT/UPDATE 时写入四列
- [x] 2.4 新增 `queryActiveTasks(teamName)` 函数，查询 `WHERE status NOT IN ('completed', 'failed')` 返回完整行（含调度状态列）

## 3. Manager persistTask 扩展

- [x] 3.1 修改 `manager/server/index.ts` 的 `setupTaskPersistence()`，将 `server` 引用传入事件监听器闭包
- [x] 3.2 修改 `persistTask()` 函数签名，新增 `server` 参数，在调用 `upsertTask()` 前通过 `server.getTaskState(task.id)` 获取调度状态
- [x] 3.3 更新所有 `setupTaskPersistence` 事件监听器调用，传入 `server` 参数

## 4. 启动时任务恢复

- [x] 4.1 在 `manager/server/index.ts` 的 `restoreTeams()` 中，Team+Server 创建并 initTeamDatabase 后，调用 `queryActiveTasks()` 获取活跃任务
- [x] 4.2 将查询结果转为 `Array<{task, state}>` 格式，调用 `server.loadTaskStates()` 加载到内存
- [x] 4.3 恢复后按状态重新 dispatch：pending → 调用 server 内部 dispatch（通过 submitFrom 或直接操作 TaskState），running → dispatch 给 pending_clients，reviewing → dispatch 给 leader
- [x] 4.4 同样新建团队的回调中也执行一次活跃任务恢复（覆盖团队创建后 Manager 重启的场景）

## 5. Client Outbox 模块

- [x] 5.1 新建 `src/utils/outbox.ts`，实现 `writeOutbox(teamName, taskId, result)` — 在 Tauri 环境写 `~/.envoy/outbox/{team}/{taskId}.json`，browser 环境为 no-op
- [x] 5.2 实现 `deleteOutbox(teamName, taskId)` — 删除对应的 outbox 文件
- [x] 5.3 实现 `scanOutbox(teamName)` — 扫描 outbox 目录返回所有未提交的结果数组
- [x] 5.4 实现 `submitWithRetry(taskService, taskId, result, maxRetries=3)` — await submitResult + 指数退避重试，成功返回 true，全失败返回 false

## 6. useTaskExecution 改造

- [x] 6.1 修改 `handleMemberExecution()`：替换 `void taskService.submitResult()` 为 `writeOutbox()` → `await submitWithRetry()` → 成功后 `deleteOutbox()`
- [x] 6.2 修改 `handleLeaderReview()`：同上 outbox 流程
- [x] 6.3 修改 browser mode 路径：使用 `await submitWithRetry()` 而非 `void`
- [x] 6.4 全部重试失败时 log error 并保留 outbox 文件，handler 仍返回结果不阻塞队列

## 7. 启动/重连时 Outbox 重发

- [x] 7.1 在 `useTeamClient.ts` 的连接成功回调中，调用 `scanOutbox()` 获取未提交结果
- [x] 7.2 遍历未提交结果，调用 `submitWithRetry()` 重发，成功后 `deleteOutbox()`
- [x] 7.3 在 WebSocket 重连成功事件中也触发 outbox 扫描
