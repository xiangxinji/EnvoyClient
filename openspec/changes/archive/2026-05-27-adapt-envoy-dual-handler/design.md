## Context

Envoy 框架（`envoy/packages/`）进行了客户端架构重构。核心变化是将单一 `doing()` handler 拆分为 `doing()` + `reviewing()` 双 handler，同时移除了 `autoSendResult` 选项和 `ClientTask.status` 字段。

当前 EnvoyClient 在 `useTaskExecution.ts` 中通过 `client.doing()` 注册单一 handler，内部用 `taskStatus === "reviewing"` 判断区分执行和审核。`useConnection.ts` 中设置了 `autoSendResult: false`。

Manager 服务端仅使用 `Team` 和 `Task` 类型及 Server 的公开方法（`submitFrom`、`receiveResult` 等），这些 API 未受影响。

## Goals / Non-Goals

**Goals:**
- 适配 envoy 新的双 handler 架构，消除 TypeScript 编译错误
- 防止 Leader 客户端因未注册 `reviewing()` 导致审核任务阻塞执行队列
- 保持现有行为不变：Member 通过 HTTP API 提交结果，Leader 通过 AI 自动审核

**Non-Goals:**
- 不改动 Manager 服务端代码
- 不改动 `TaskCenterView/main.vue`（无需改动）
- 不引入 `client.review()` 或 `client.sendResult()` 的 WebSocket 路径（继续使用 HTTP API）
- 不重构 `useTaskExecution.ts` 的整体架构

## Decisions

### 1. 拆分 handler 而非内联判断

**选择**: 使用 `client.doing()` + `client.reviewing()` 两个独立注册调用

**替代方案**: 继续在单一 `doing()` handler 中通过 `clientTask.reason === "review"` 判断

**理由**: envoy 的 `processNext()` 按 `queue[0].reason` 选择 handler。即使 `doing()` handler 内部能区分 reason，`processNext()` 仍然会把 review 任务分配给 `reviewHandler`。如果不注册 `reviewHandler`，review 任务永远占据 queue[0]，阻塞所有后续任务。因此**必须**注册 `reviewing()`。

### 2. 不监听 review_* 事件

**选择**: 不添加 `review_queued/review_started/review_finished` 等事件监听

**理由**: `syncQueue` 同步 `client.taskQueue` 到 Vue ref，但 TaskCenterView 的 current/queued section 只在 Member 角色下渲染（`v-if="role === 'member'"`）。Member 不会收到 review dispatch（Server 只向 `task.createBy` 发 review），所以 `task_*` 事件已足够。Leader 不显示队列，review 事件不影响 UI。

### 3. 删除 autoSendResult 而非保留

**选择**: 直接删除 `autoSendResult: false`

**理由**: 新 envoy 已移除该选项，`ClientOptions` 类型中不存在此字段。当前代码设置 `false` 是为了手动通过 HTTP API 提交结果，新 envoy 默认就不自动发送，行为一致。

## Risks / Trade-offs

- **[风险] Member 意外收到 review dispatch** → Server 只向 `task.createBy` 发 review，Member 不会收到。即使收到，`processNext` 会因 `reviewHandler` 为 null 而跳过（不阻塞，因为 `fn` 为 null 时 return 不消耗 queue），但该 review 任务会滞留在队列中。→ 可接受，概率极低。
- **[风险] Leader 未收到 review dispatch 时任务挂起** → 这是 envoy Server 端行为，`dispatchToLeader` 在 Leader 离线时直接 `finishTask`。不影响 Client 端逻辑。
