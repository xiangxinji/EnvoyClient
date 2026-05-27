## Why

Envoy 框架进行了架构重构，将 Client 端的任务处理从单一 `doing()` handler 拆分为 `doing()` + `reviewing()` 双 handler 模式。同时移除了 `autoSendResult` 选项和 `ClientTask.status` 字段。EnvoyClient 必须适配这些破坏性变更，否则 TypeScript 编译失败且 Leader 客户端的审核任务会永久阻塞执行队列。

## What Changes

- **BREAKING**: `ClientTask.status` 字段移除，替换为 `ClientTask.reason: "execute" | "review"`
- **BREAKING**: `ClientOptions.autoSendResult` 选项移除，handler 完成后不再自动发送结果
- **BREAKING**: Review 任务不再通过 `doing()` 分发，改由独立的 `reviewing()` handler 处理
- 新增 `client.reviewing(fn)` 方法注册审核任务处理器
- 新增 `client.review(taskId, approved, data?, error?)` 便捷方法
- 新增 review 独立事件流：`review_queued/started/completed/failed/skipped/finished`
- `client.sendResult()` 从 private 变为 public

## Capabilities

### New Capabilities

（无新增能力，本次为适配已有框架变更）

### Modified Capabilities

- `task-execution`: 适配 envoy 双 handler 架构，将单一 `doing()` handler 拆分为 `doing()`（execute）+ `reviewing()`（review），移除 `autoSendResult` 依赖

## Impact

- `src/composables/useTaskExecution.ts` — 核心改动，拆分 handler 注册逻辑
- `src/composables/useConnection.ts` — 移除 `autoSendResult: false`（一行删除）
- `src/views/TaskCenterView/main.vue` — 无需改动（仅访问 `ct.serverTask.*`）
- `manager/server/` — 无需改动（使用的 Server API 均未变更）
