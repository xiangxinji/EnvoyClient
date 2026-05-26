## Context

当前 Tauri 客户端的 `useTaskExecution` 在 `doing` handler 中直接执行 pipeline 或返回 `SKIP_RESULT`。Envoy 框架提供的 `ClientTask` 串行队列（`client.currentTask`、`client.queueLength`、`client.taskQueue`）在 UI 层未被消费。聊天界面和任务中心都有操作按钮，职责分散。

## Goals / Non-Goals

**Goals:**
- Member 侧任务执行由 ClientTask 队列驱动，`doing` handler 仅桥接到 UI 层
- 任务中心成为唯一的任务操作入口，包含"当前任务"和"等待中"区域
- 聊天界面 TaskCard 变为纯只读，点击跳转任务中心
- Manual/Auto 模式区别仅在于 dequeue 后是否自动执行，都只操作当前任务
- Leader 侧 reviewing 审核不受队列约束，保持现有行为

**Non-Goals:**
- 不修改 Envoy 框架本身的 Client/ClientTask 实现
- 不改变任务 dispatch/result 的 REST API 接口
- 不改变 Leader 侧的审核流程
- 不做任务优先级排序（按 FIFO 顺序）

## Decisions

### Decision 1: doing handler 使用 await 桥接模式

`doing` handler 收到 ClientTask 后，不执行 pipeline，而是：
1. 将 ClientTask 暴露为响应式 `currentClientTask`
2. 返回一个 Promise，等待 UI 层的完成信号

```typescript
let pendingResolve: ((result: unknown) => void) | null = null;
const currentClientTask = ref<ClientTask | null>(null);

client.doing(async (clientTask) => {
  currentClientTask.value = clientTask;

  // Leader reviewing: 直接执行，不走队列等待
  if (role === "leader" && clientTask.serverTask.status === "reviewing") {
    return await handleLeaderReview(clientTask);
  }

  // Member: 通知 UI，等待完成信号
  return new Promise((resolve) => {
    pendingResolve = resolve;
  });
});
```

**Why not 另建队列**: Envoy Client 已有完整的串行队列实现（`processNext` 自动循环），重新实现是重复工作。利用 `doing` handler 的阻塞特性，handler resolve 后 `processNext` 自动 dequeue 下一个，天然实现了循环。

**Why Leader 例外**: Leader reviewing 是轻量操作（改状态），不需要排队等待，直接在 handler 内执行更简单。

### Decision 2: useTaskExecution 拆分为桥接层 + 执行层

当前 `useTaskExecution` 同时负责桥接和执行。拆分为：

- `useTaskExecution` — 桥接层：注册 `doing` handler，暴露 `currentClientTask`、`resolveCurrentTask`
- 执行逻辑移入 TaskCenter 的 composable — 在 TaskCenter 中根据模式触发执行

```
useTaskExecution (桥接)
  ├── currentClientTask: Ref<ClientTask | null>
  ├── resolveCurrentTask(result): void
  └── registerHandler(client)

TaskCenter (消费)
  ├── 监听 currentClientTask 变化
  ├── Auto 模式 → 自动调用 executeCurrentTask()
  └── Manual 模式 → 等用户点击 → 调用 executeCurrentTask()
```

### Decision 3: TaskCenter 新增当前任务和等待中区域

TaskCenter 当前按 running/pending/completed/failed/reviewing 分组。新增：

- **当前任务区域**（置顶）：取 `client.currentTask` 对应的任务，显示完整操作按钮
- **等待中区域**：取 `client.taskQueue` 中的任务列表，只读显示
- 原有的 running/pending/completed/failed 分组中，排除掉当前正在 ClientTask 队列中的任务（避免重复显示）

数据源映射：
```
client.currentTask → 当前任务区域
client.taskQueue   → 等待中区域
REST API tasks     → completed / failed / 其他非队列任务
```

### Decision 4: 聊天 TaskCard 移除操作按钮

TaskCard 组件保留 `TaskActionButtons` 的 import，但通过 prop `showActions` 控制：
- 聊天中：`showActions={false}`，纯只读
- 任务中心当前任务：`showActions={true}`，显示操作按钮
- 任务中心其他分组：`showActions={false}`，只读

## Risks / Trade-offs

**[doing handler 阻塞风险]** → `doing` handler 的 Promise 如果永远不 resolve，队列会卡死。Mitigation: 在 `resolveCurrentTask` 中加入超时机制（如 30 分钟），超时后自动 resolve error。

**[ClientTask 与 REST Task 数据不一致]** → ClientTask 的 `serverTask` 是 dispatch 时刻的快照，后续状态变更通过 REST API 的 `"task"` 事件更新。当前任务区域需要合并两个数据源。Mitigation: 用 `taskId` 做 key，以 REST API 的最新 Task 数据为主，ClientTask 仅用于判断"是否是当前正在执行的"。

**[页面切换丢失状态]** → 用户从任务中心切到聊天再切回来，`currentClientTask` 是 composable 级别的 ref，不在组件内，不会丢失。但 `useTaskExecution` 的生命周期需要绑定到 `useTeamClient` 而非单个组件。
