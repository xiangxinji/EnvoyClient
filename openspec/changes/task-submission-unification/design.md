## 维度一：统一提交通道

### 当前问题

```
4 条提交路径 ──────────────────────────────────────► Server.processResult()

  1. autoSendResult (WebSocket)     ──► sendResult()
  2. outbox + submitWithRetry (REST) ──► /api/tasks/:id/result
  3. taskService.complete (REST)     ──► /api/tasks/:id/complete
  4. Leader review (REST)            ──► /api/tasks/:id/result
```

- 路径 1 和 2 会**重复提交**同一个结果
- 路径 3 和 2 的 payload 格式不同（`TaskCompleteData` vs `TaskSubmitResult`）
- 超时（路径 4 的特殊情况）**不写 outbox**，可能丢失

### 目标状态

```
唯一提交通道 ──────────────────────────────────────► Server.processResult()

  resolveCurrentTask(TaskResolution)
    │
    ▼
  writeOutbox(resultPayload)
    │
    ▼
  submitWithRetry(taskService.submitResult)
    │
    ├── 成功 → deleteOutbox()
    └── 失败 → 保留 outbox，重连时 flushOutbox()
```

### 决策

#### Decision 1: 桥接模式关闭 autoSendResult

Client 初始化时设置 `autoSendResult: false`。所有结果提交统一由 outbox 机制处理。

```typescript
const taskExec = useTaskExecution({
  role,
  myId: conn.myId,
  teamName: conn.teamName,
  autoSendResult: false,
});
```

**Why**: outbox 机制有落盘+重试+恢复的完整可靠性，autoSendResult 是"尽力而为"的 fire-and-forget。两者并存时，outbox 已经覆盖了 autoSendResult 的能力，后者变成多余的第二条路。

#### Decision 2: 统一 TaskResolution 结构

```typescript
interface TaskResolution {
  success: boolean;
  source: "manual" | "ai" | "timeout" | "aborted";
  data?: Record<string, unknown>;
  error?: string;
  trace?: AgentStep[];
}
```

所有 `resolveCurrentTask()` 调用必须使用此结构：

```typescript
// 手动完成
resolveCurrentTask({ success: true, source: "manual", data: { ... } })

// AI 执行完成
resolveCurrentTask({ success: true, source: "ai", data: parsed, trace: allTraces })

// 超时
resolveCurrentTask({ success: false, source: "timeout", error: "execution_timeout" })

// 用户中止
resolveCurrentTask({ success: false, source: "aborted", error: "user aborted" })
```

**Why**: 现在 `resolveCurrentTask({ manual: true })` 和 `resolveCurrentTask(parsed)` 格式完全不同，Server 端收到的 `client-result` Resource 内容不一致。统一后所有路径产出相同结构，降低消费方解析成本。

#### Decision 3: 废弃 REST /complete 和 manualCompleteTask

TaskCard 的手动操作（"开始"、"完成"）不再直接调用 REST 端点，改为：

```
TaskCard "完成" 按钮
  │
  ▼
@task-resolved → resolveCurrentTask({ success: true, source: "manual" })
  │
  ▼
useTaskExecution.resolveCurrentTask() → pendingResolve 释放
  │
  ▼
processNext() 拿到 result → autoSendResult(已关闭，不发送)
  │
  ▼
TaskCenter 的 watch 或 after-execute hook 触发 outbox 写入
```

等等——如果 autoSendResult 关闭了，那 `doing` handler 返回后结果怎么提交？

**修正：outbox 写入应该在 resolveCurrentTask 之后、handler 返回之前完成。**

```typescript
function resolveCurrentTask(result: TaskResolution) {
  // 1. 先写 outbox
  writeOutbox(teamName, taskId, buildPayload(result))
  
  // 2. 异步提交（不阻塞 UI）
  submitWithRetry(taskService.submitResult)
    .then(ok => { if (ok) deleteOutbox(...) })
  
  // 3. 释放 doing handler 的 Promise
  pendingResolve(result)
}
```

**Why**: 把 outbox 写入放在 `resolveCurrentTask` 内部而不是 `executeCurrentTask` 内部，这样无论谁调用 `resolveCurrentTask`（UI 手动、AI 执行、超时回调），都会自动走 outbox 路径。消除了"超时不写 outbox"的 bug。

#### Decision 4: outbox 增加唯一提交 ID

```typescript
interface OutboxEntry {
  id: string;        // uuid() 或 `${taskId}-${attempt}-${timestamp}`
  teamName: string;
  taskId: string;
  attempt: number;
  // ... 其他字段
}
```

Server 端 `/result` 端点在 `addResource` 前检查是否已有相同 `outboxId` 的 resource，存在则跳过。

**Why**: 防止 flushOutbox 和网络重试导致重复追加 `client-result`。

---

## 维度二：简化 ClientTask 状态

### 当前问题

```
ClientTask.status = "running"  和  serverTask.status = "running"
含义完全不同但名字相同，阅读代码时需要反复切换上下文。

而且 ClientTask.status 几乎无人消费——UI 用 currentClientTask !== null 判断。
```

### 目标状态

```
ClientTask 不再有 status 字段。

状态由队列位置推断：
  client.running === this         → 正在执行
  client.queue.includes(this)     → 排队等待
  completedAt !== undefined       → 已结束
  error !== undefined             → 执行失败

ClientTask 只保留：
  - id: 唯一标识
  - serverTask: 服务端任务快照
  - startedAt / completedAt: 时间戳
  - result / error: 执行结果
```

### 决策

#### Decision 1: 移除 ClientTask.status

`ClientTask` 接口改为：

```typescript
export interface ClientTask {
  id: string;
  serverTask: Task;
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}
```

状态推断逻辑：

```typescript
function isExecuting(task: ClientTask, client: Client): boolean {
  return client.currentTask?.id === task.id;
}

function isQueued(task: ClientTask, client: Client): boolean {
  return client.taskQueue.some(t => t.id === task.id);
}

function isFinished(task: ClientTask): boolean {
  return task.completedAt !== undefined;
}

function isFailed(task: ClientTask): boolean {
  return task.completedAt !== undefined && task.error !== undefined;
}
```

**Why**: 消除冗余状态。队列位置本身就是最权威的状态来源，不需要额外维护一个可能不一致的 status 字段。

#### Decision 2: 超时标记为 failed 而非 completed

```typescript
// processNext 中
} catch (err) {
  task.error = err instanceof Error ? err.message : String(err);
  task.completedAt = Date.now();
  // task.status 不再设置，由 completedAt + error 推断为 failed
  this.emit("task_failed", task);
```

超时通过 `throw new Error("execution_timeout")` 触发 catch 路径：

```typescript
timeoutTimer = setTimeout(() => {
  if (pendingResolve === resolve) {
    pendingResolve = null;
    throw new Error("execution_timeout");  // 触发 catch 路径
  }
}, EXECUTION_TIMEOUT_MS);
```

**Why**: 超时不是"成功完成"，标记为 completed 会让 Server 端的 `processResult` 走 success 分支。超时应该走 failed 路径，并且被 outbox 捕获（现在超时走 resolve 不写 outbox）。

等等——throw 在 Promise executor 里不会触发 `processNext` 的 catch。Promise executor 里的 throw 是 unhandled rejection。

**修正：resolve 一个 error 对象，但在 handler 返回后判断**

```typescript
// doing handler
return new Promise((resolve) => {
  pendingResolve = resolve;
  timeoutTimer = setTimeout(() => {
    pendingResolve = null;
    resolve({ __timeout: true, error: "execution_timeout" });
  }, EXECUTION_TIMEOUT_MS);
});

// processNext 中
const result = await this.handler(task);

if (result && (result as any).__timeout) {
  task.error = (result as any).error;
  task.completedAt = Date.now();
  this.emit("task_failed", task);
  // ...
}
```

这太丑了。更好的方式：

```typescript
// doing handler 直接 throw 一个 Sentinel
const TIMEOUT_SENTINEL = Symbol("execution_timeout");

return new Promise((resolve, reject) => {
  pendingResolve = resolve;
  timeoutTimer = setTimeout(() => {
    pendingResolve = null;
    reject(TIMEOUT_SENTINEL);
  }, EXECUTION_TIMEOUT_MS);
});
```

但 `reject` 在 Promise executor 中不会被 `await this.handler(task)` 的 try/catch 捕获——它会变成 unhandled rejection。

**最终方案：用 resolve + 哨兵值，在 processNext 中判断**

```typescript
export const EXECUTION_TIMEOUT = Symbol("execution_timeout");

// processNext 中
const result = await this.handler(task);

if (result === EXECUTION_TIMEOUT) {
  task.error = "execution_timeout";
  task.completedAt = Date.now();
  this.emit("task_failed", task);
  // ... 其余 failed 逻辑
  return;
}
```

#### Decision 3: pendingResolve 改用 Map

```typescript
const pendingResolves = new Map<string, {
  resolve: (result: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}>();
```

**Why**: 虽然当前 `client.doing` 是顺序执行，但 `resolveCurrentTask` 是暴露给 UI 的公开方法，不应依赖内部调度顺序的正确性。Map 提供了 taskId 级别的隔离。

#### Decision 4: 可配置超时

```typescript
// settings.yml
task_execution_timeout_ms: 600000  // 默认 10 分钟

// useTaskExecution 中
const timeout = settings.value.task_execution_timeout_ms ?? 10 * 60 * 1000;
```

UI 层增加"中止任务"按钮：

```typescript
function abortCurrentTask() {
  resolveCurrentTask({
    success: false,
    source: "aborted",
    error: "User aborted execution"
  });
}
```

---

## 风险与 Trade-offs

### [ClientTask 移除 status 可能影响下游]
→ 搜索所有 `clientTask.status` 引用。当前只有 `client.ts` 内部使用（emit 事件时设置）。UI 层用 `currentClientTask !== null` 判断，不读 status。

### [关闭 autoSendResult 后，非 outbox 路径的任务无法提交]
→ 确认所有执行路径都经过 `resolveCurrentTask`。Leader reviewing 路径需要单独处理——它不调用 `resolveCurrentTask`，而是直接 `writeOutbox + submitWithRetry`。关闭 autoSendResult 后不影响它，因为它已经在 handler 内部完成了提交。

### [移除 /complete 端点是 Breaking Change]
→ 如果有外部系统调用了这个端点，需要迁移。当前只有前端 `TaskService.complete()` 调用，可以同步移除。

### [哨兵值 vs throw]
→ 哨兵值方案不优雅，但 Promise executor 中的 throw 确实无法被外部 catch。可以考虑用 `AbortController` 模式，但改动更大。哨兵值是最小的正确方案。
