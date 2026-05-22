## Architecture

```
┌─ envoy/packages/client/client.ts ──────────────────────┐
│  Client (扩展)                                         │
│  + taskQueue getter                                    │
│  + taskHistory getter                                  │
│  + 5 events: task_queued/started/completed/failed/skipped │
│  + private history[] (cap 20)                          │
└────────────┬───────────────────────────────────────────┘
             │ events
             ▼
┌─ src/composables/useClientTaskQueue.ts ────────────────┐
│  订阅 Client 事件 → 维护响应式状态                      │
│  + queue: Ref<ClientQueueTask[]>                       │
│  + running: Ref<ClientQueueTask | null>                │
│  + history: Ref<ClientQueueTask[]>                     │
│  + agentStep: computed from useAgent                   │
│  + agentRunning: computed from useAgent                │
└────────────┬───────────────────────────────────────────┘
             │ reactive refs
             ▼
┌─ src/components/TaskQueuePanel/ ───────────────────────┐
│  main.vue + styles.css                                 │
│  垂直队列: Running → Queued → Recent                    │
└────────────────────────────────────────────────────────┘
```

## 框架层改动 — Client 类

### 新增事件类型

在 `ClientEvents` 中追加：

```ts
// envoy/packages/client/client.ts
export type ClientEvents = {
  // ... 现有事件 ...
  "task_queued": (task: ClientTask) => void;
  "task_started": (task: ClientTask) => void;
  "task_completed": (task: ClientTask) => void;
  "task_failed": (task: ClientTask) => void;
  "task_skipped": (task: ClientTask) => void;
};
```

### 新增属性

```ts
private history: ClientTask[] = [];
private static readonly HISTORY_LIMIT = 20;

get taskQueue(): readonly ClientTask[] {
  return this.queue;
}

get taskHistory(): readonly ClientTask[] {
  return this.history;
}
```

### 事件触发位置

**handleDispatch** — 任务入队时：
```ts
private handleDispatch(msg: Message): void {
  // ... 现有去重逻辑 ...
  this.queue.push(clientTask);
  this.emit("task_queued", clientTask);   // ← 新增
  this.processNext();
}
```

**processNext** — 各状态分支：
```ts
private async processNext(): Promise<void> {
  // ... 现有 queue.shift / running 赋值 ...
  this.emit("task_started", task);        // ← 新增

  try {
    const result = await this.handler(task);

    if (result === SKIP_RESULT) {
      this.emit("task_skipped", task);    // ← 新增
      this.running = null;
      this.processNext();
      return;
    }

    task.status = "completed";
    task.result = result;
    task.completedAt = Date.now();
    this.emit("task_completed", task);    // ← 新增
    this.pushHistory(task);               // ← 新增
    // ... 现有 sendResult 逻辑 ...
  } catch (err) {
    task.status = "failed";
    task.error = err instanceof Error ? err.message : String(err);
    task.completedAt = Date.now();
    this.emit("task_failed", task);       // ← 新增
    this.pushHistory(task);               // ← 新增
    // ... 现有 sendResult 逻辑 ...
  }

  this.running = null;
  this.processNext();
}

private pushHistory(task: ClientTask): void {
  this.history.unshift(task);
  if (this.history.length > Client.HISTORY_LIMIT) {
    this.history.pop();
  }
}
```

### 不改的部分

- `autoSendResult` 逻辑不变
- `doing()` / `submit()` / `send()` 不变
- `ClientTask` 接口不变
- 心跳逻辑不变

## 桥接层 — useClientTaskQueue

### 数据结构

```ts
// src/composables/useClientTaskQueue.ts
interface ClientQueueTask {
  clientTaskId: string;       // ct-xxx
  taskId: string;             // serverTask.id
  content: string;            // serverTask.content（截断 80 字符）
  status: "queued" | "running" | "completed" | "failed" | "skipped";
  startedAt?: number;
  completedAt?: number;
  duration?: number;          // completedAt - startedAt (ms)
  error?: string;
}
```

### Composable 签名

```ts
export function useClientTaskQueue(
  client: Client,
  agent: { isRunning: Ref<boolean>; currentStep: Ref<number> }
) {
  const queue = ref<ClientQueueTask[]>([]);
  const running = ref<ClientQueueTask | null>(null);
  const history = ref<ClientQueueTask[]>([]);

  // 从 ClientTask 转换为 ClientQueueTask（截断 content）
  function toQueueTask(ct: ClientTask, status: ClientQueueTask["status"]): ClientQueueTask { ... }

  // 订阅事件
  client.on("task_queued", (ct) => { queue.value.push(toQueueTask(ct, "queued")); });
  client.on("task_started", (ct) => {
    running.value = toQueueTask(ct, "running");
    queue.value = queue.value.filter(t => t.clientTaskId !== ct.id);
  });
  client.on("task_completed", (ct) => {
    history.value.unshift(toQueueTask(ct, "completed"));
    if (history.value.length > 20) history.value.pop();
    running.value = null;
  });
  client.on("task_failed", (ct) => {
    history.value.unshift(toQueueTask(ct, "failed"));
    if (history.value.length > 20) history.value.pop();
    running.value = null;
  });
  client.on("task_skipped", (ct) => {
    history.value.unshift(toQueueTask(ct, "skipped"));
    running.value = null;
  });

  const agentStep = computed(() => agent.currentStep.value);
  const agentRunning = computed(() => agent.isRunning.value);

  return { queue, running, history, agentStep, agentRunning };
}
```

### 全局注册

`useTeamClient` 初始化时创建实例：

```ts
// useTeamClient.ts
const clientTaskQueue = useClientTaskQueue(conn.client, taskExec.agent);
```

`teamClientContext.ts` 暴露 getter：

```ts
let _clientTaskQueue: ReturnType<typeof useClientTaskQueue> | null = null;

export function setClientTaskQueue(q: typeof _clientTaskQueue) { _clientTaskQueue = q; }
export function getClientTaskQueue() { return _clientTaskQueue!; }
```

## UI 层 — TaskQueuePanel

### 模板结构

```
TaskQueuePanel
├── header: "Task Queue" + 任务总数 badge
├── body
│   ├── Running 区 (v-if="running")
│   │   └── 卡片: content + 进度条 + step + elapsed
│   ├── Queued 区 (v-if="queue.length")
│   │   └── 列表: 紧凑卡片 × N
│   └── Recent 区 (v-if="history.length")
│       └── 列表: completed/failed 卡片
└── 空状态 (v-if="!running && !queue.length && !history.length")
```

### Running 卡片

```
┌───────────────────────────────────────────────────┐
│  ● 分析数据库日志并生成报告                        │  ← content
│                                                   │
│  ████████████░░░░░░░░  Step 5 / 20               │  ← 进度条
│                                                   │
│  23s                                              │  ← elapsed
└───────────────────────────────────────────────────┘
```

- 背景: `var(--task-running-bg)`
- 左边框: 3px `var(--task-running-border)`
- 进度条宽度: `(agentStep / 20) * 100%`，`var(--accent)` 色
- elapsed: `setInterval` 每秒更新 `Date.now() - startedAt`

### Queued 卡片

```
┌─────────────────────────────────────┐
│  ○  备份用户配置文件                  │
└─────────────────────────────────────┘
```

- 背景: `var(--task-pending-bg)`
- 左边框: 无
- 紧凑：padding 比 running 卡片小

### Recent 卡片

```
┌─────────────────────────────────────────────┐
│  ✓  检查服务器状态          completed  12s   │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  ✗  部署前端应用              failed  45s    │
│     Agent execution timeout                 │
└─────────────────────────────────────────────┘
```

- completed: `var(--task-completed-bg)`，`var(--task-completed-text)` 色标记
- failed: `var(--task-failed-bg)`，`var(--task-failed-text)` 色标记，下方显示 error
- skipped: `var(--task-pending-bg)`，灰色标记

### 空状态

```
     ○
  队列为空
  等待任务派发...
```

- 居中，`var(--text-muted)` 色
- icon 用 `SvgIcon name="circle"`

### 进度条实现

纯 CSS，无第三方库：

```css
.progress-bar {
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}
```

### elapsed 计时器

```ts
// main.vue
const now = ref(Date.now());
let timer: number | undefined;

onMounted(() => { timer = window.setInterval(() => { now.value = Date.now(); }, 1000); });
onUnmounted(() => { clearInterval(timer); });

function formatElapsed(startedAt?: number): string {
  if (!startedAt) return "";
  const diff = Math.floor((now.value - startedAt) / 1000);
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}m ${diff % 60}s`;
}
```

## Sidebar 集成

### MemberSidebar

在工具区（cloud / tasks / dispatch 之间）新增队列入口：

```ts
// 工具列表中，在 __tasks__ 之后插入
items.push("__queue__");
```

图标: 使用现有 `SvgIcon name="tasks"` 或复用其他图标
badge: 显示 `queue.length`（排队中任务数）

### ChatView 路由

```vue
<TaskQueuePanel v-else-if="selectedPeer === '__queue__'" />
```

放在 `__tasks__` 路由之后、`__cloud__` 路由之前。

## 不做的事

- 不做 Agent reasoning 实时预览（running 卡片只显示 step 进度，不显示推理文本）
- 不做任务取消功能（Agent 循环不支持中途取消）
- 不做 history 持久化（刷新清空）
- 不引第三方可视化库
- 不改 Client 的 doing / processNext 核心逻辑
