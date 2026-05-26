## Why

当前 Tauri 客户端的任务执行完全绕过了 Envoy 框架的 ClientTask 队列机制：`doing` handler 要么直接执行 pipeline（auto 模式），要么返回 `SKIP_RESULT` 丢弃任务（manual 模式）。Envoy 提供的 `currentTask`、`queueLength`、`taskQueue` 等响应式状态在 UI 层完全未被消费。同时，聊天界面的 TaskCard 内嵌了手动操作按钮，与任务中心的操作入口重复，导致用户需要在两个地方管理任务。

## What Changes

- **BREAKING** `doing` handler 从"直接执行"改为"桥接模式"：收到 ClientTask 后仅通知 UI 层（设置 currentTask），然后 await 完成信号。不再内部调用 pipeline 或返回 SKIP_RESULT
- **BREAKING** 聊天界面 TaskCard 移除所有操作按钮（TaskActionButtons），变为纯只读展示。点击卡片跳转任务中心
- 任务中心新增"当前任务"区域，显示 ClientTask 队列中正在执行的任务，这是唯一的任务操作入口
- 任务中心新增"等待中"分组，显示 ClientTask 队列中排队等待的任务（不可操作）
- Manual/Auto 模式的区别仅在于：dequeue 后是立刻执行还是等用户点"执行"按钮。两者都只操作当前任务
- Leader 侧 reviewing 审核不受 ClientTask 队列约束，保持现有行为

## Capabilities

### New Capabilities
- `client-task-queue-bridge`: Member 侧 ClientTask 队列桥接机制 — doing handler 改为通知 UI + await 完成信号的桥接模式，TaskCenter 通过响应式状态消费 ClientTask 队列

### Modified Capabilities
- `task-center`: 新增"当前任务"区域（唯一操作入口）和"等待中"分组（队列中待执行任务）
- `task-manual-operations`: 操作按钮从 TaskCard（聊天内）移除，仅在任务中心的当前任务区域显示
- `member-react-agent`: doing handler 从直接执行 pipeline 改为桥接模式，pipeline 执行由 TaskCenter 触发
- `envoy-vue-client`: 已定义的 `currentTask` 和 `queueLength` 响应式状态需在 TaskCenter 中实际消费

## Impact

- `src/composables/useTaskExecution.ts` — 重写 registerHandler 为桥接模式
- `src/components/TaskCard/main.vue` — 移除 TaskActionButtons 引用
- `src/components/TaskActionButtons/main.vue` — 仅在 TaskCenter 当前任务区域使用
- `src/views/TaskCenterView/main.vue` — 新增当前任务区域和等待中分组
- `src/views/ChatView/main.vue` — 传递队列状态到 TaskCenter
- `src/composables/useConnection.ts` — 暴露 client 的 currentTask、queueLength、taskQueue
