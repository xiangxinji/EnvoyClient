## Phase 1: 统一提交通道

### 1.1 定义 TaskResolution 类型
- **文件**: `src/types.ts`
- **内容**: 新增 `TaskResolution` 接口（success/source/data/error/trace）
- **验证**: TypeScript 编译通过

### 1.2 关闭 autoSendResult
- **文件**: `src/composables/useTeamClient.ts`（Client 初始化）
- **内容**: 添加 `autoSendResult: false` 到 ClientOptions
- **验证**: 确认所有执行路径都经过 outbox

### 1.3 统一 resolveCurrentTask 为 TaskResolution
- **文件**: `src/composables/useTaskExecution.ts`
- **内容**: 
  - `resolveCurrentTask` 参数类型改为 `TaskResolution`
  - 在 `resolveCurrentTask` 内部完成 outbox 写入（从 executeCurrentTask 移入）
  - 所有调用方改为统一格式
- **验证**: 所有 resolveCurrentTask 调用符合 TaskResolution

### 1.4 重写 useTaskCenterExecution
- **文件**: `src/composables/useTaskCenterExecution.ts`
- **内容**:
  - 移除内部 writeOutbox/submitWithRetry 调用（已移入 resolveCurrentTask）
  - executeCurrentTask 完成后调用 resolveCurrentTask({ success, source: "ai", ... })
  - catch 块同理
- **验证**: 执行完成后 outbox 被正确写入

### 1.5 移除 REST /complete 和 manualCompleteTask
- **文件**: `manager/server/routes/messages.ts`、`src/services/TaskService.ts`、`envoy/packages/server/server.ts`
- **内容**:
  - 移除 `/api/tasks/:id/complete` 端点
  - 移除 `TaskService.complete()` 方法
  - 移除 `Server.manualCompleteTask()` 方法（或标记 @deprecated）
- **验证**: 无调用方引用 complete/completeTask

### 1.6 TaskCard 手动操作迁移
- **文件**: `src/components/TaskCard/main.vue`
- **内容**: "完成"按钮改为 emit `task-resolved` 事件，由 TaskCenter 调用 resolveCurrentTask
- **验证**: UI 操作后 outbox 写入 + REST 提交成功

### 1.7 outbox 增加唯一提交 ID + Server 幂等
- **文件**: `src/utils/outbox.ts`、`manager/server/routes/messages.ts`
- **内容**:
  - OutboxEntry 增加 `id` (uuid) 和 `attempt` 字段
  - `/result` 端点检查是否已有相同 outboxId 的 resource
- **验证**: 重复提交不会追加重复 resource

---

## Phase 2: 简化 ClientTask 状态

### 2.1 移除 ClientTask.status 字段
- **文件**: `envoy/packages/client/client.ts`
- **内容**:
  - ClientTask 接口移除 `status` 字段
  - `handleDispatch` 中不再设置 `clientTask.status`
  - `processNext` 中不再设置 `task.status`
- **验证**: 无 `clientTask.status` 引用

### 2.2 超时走 failed 路径（哨兵值方案）
- **文件**: `envoy/packages/client/client.ts`
- **内容**:
  - 新增 `EXECUTION_TIMEOUT` 哨兵 Symbol
  - `processNext` 中检查结果是否为哨兵值，是则走 failed 逻辑
  - `useTaskExecution.ts` 中超时改为 resolve 哨兵值
- **验证**: 超时后 task_failed 事件被 emit

### 2.3 pendingResolve 改用 Map
- **文件**: `src/composables/useTaskExecution.ts`
- **内容**:
  - `pendingResolves` Map<string, { resolve, timer }>
  - `resolveCurrentTask(taskId, result)` 签名改为接收 taskId
  - 或者保持当前签名（通过 currentClientTask.value.serverTask.id 推断 taskId）
- **验证**: 并发调用 resolveCurrentTask 不会互相覆盖

### 2.4 可配置超时
- **文件**: `src/composables/useTaskExecution.ts`、`src/composables/useTaskCenterExecution.ts`
- **内容**:
  - 读取 `settings.value.task_execution_timeout_ms`
  - 默认 10 分钟
  - 传递给 doing handler
- **验证**: 超时时间可通过 settings 调整

### 2.5 更新 UI 层状态判断逻辑
- **文件**: `src/views/TaskCenterView/main.vue`、`src/components/FloatingBadge/main.vue`
- **内容**:
  - `currentClientTask !== null` 替代 `currentClientTask.value?.status === "running"`
  - `clientTaskQueue.length` 替代队列中 status 过滤
  - FloatingBadge 的 `queueLength` 和 `taskHistory` 不受影响（只读数字）
- **验证**: UI 显示正确的任务状态

### 2.6 增加"中止任务"按钮（可选）
- **文件**: `src/views/TaskCenterView/main.vue`
- **内容**: 执行中显示"中止"按钮，调用 `resolveCurrentTask({ success: false, source: "aborted" })`
- **验证**: 中止后任务进入 failed 状态

---

## 依赖关系

```
Phase 1 (统一提交)          Phase 2 (状态简化)
  1.1 定义 TaskResolution     2.1 移除 status
  1.2 关闭 autoSendResult     2.2 超时 failed 路径
  1.3 统一 resolveCurrentTask 2.3 pendingResolve Map
  1.4 重写 useTaskCenterExec  2.4 可配置超时
  1.5 移除 /complete          2.5 UI 状态判断
  1.6 TaskCard 迁移           2.6 中止按钮（可选）
  1.7 outbox 幂等

Phase 1 和 Phase 2 可以并行开始，但 2.1 需要 1.2 完成后再改 client.ts
推荐顺序：Phase 1 全部 → Phase 2 全部
```

## 验证策略

- 每个 task 完成后检查 TypeScript 编译
- Phase 1 完成后手动测试：手动完成、自动执行、超时、重连恢复
- Phase 2 完成后检查所有 ClientTask 引用的编译错误
- 最终验证：完整任务生命周期（创建 → dispatch → 执行 → 提交 → 完成）
