# Team Task 机制

## 概述

Envoy Team Task 是一个多人协作任务调度系统。Leader 创建任务并指定 Member 列表和分派模式，系统按规则将任务分发给 Member 执行，Member 完成后由 Leader 审核确认。

核心特点：
- **两种分派模式**：串行（依次执行）、并行（同时执行）
- **两种执行模式**：自动（Agent 执行）、手动（UI 操作）
- **Leader 审查**：所有 Member 完成后，Leader 决定通过或驳回
- **驳回重试**：Leader 可驳回任务，系统重新分派给所有 Member（最多 10 次）

---

## 数据模型

### Task（服务端核心）

```
Task {
  id: string              // "task-{timestamp}-{counter}"
  createBy: string        // 任务创建者（Leader）
  subscribe: string[]     // 订阅者列表（Member ID 数组）
  content: string         // 任务描述
  mode: "serial" | "parallel"  // 分派模式
  status: TaskStatus      // 当前状态
  resources: Resource[]   // 资源池（追加式）
  createdAt: number       // 创建时间戳
  attempt: number         // 当前尝试轮次（从 1 开始，驳回重试递增）
}
```

### Resource（任务资源）

```
Resource {
  type: string      // 资源类型："client-result" | "leader-review" | "file-resource" | "execution-trace"
  by: string        // 产生者 ID
  data: unknown      // 资源内容
  attempt: number   // 记录时的 task.attempt 快照
}
```

资源类型说明：

| type | 含义 | 产生时机 |
|------|------|---------|
| `client-result` | Member 执行结果 | Agent 执行完成 / 手动标记完成 |
| `leader-review` | Leader 审查结果 | Leader 审核通过或驳回 |
| `file-resource` | 上传的文件 | Member 通过 UI 上传 |
| `execution-trace` | Agent 执行轨迹 | Agent ReAct 循环记录 |

### TaskState（服务端内部状态）

```
TaskState {
  task: Task                     // 关联的 Task 对象
  serialIndex: number            // 串行模式当前位置（指向 subscribe[] 索引）
  pendingClients: Set<string>    // 尚未返回结果的 Member 集合
  leaderReviewing: boolean       // 是否处于 Leader 审查阶段
  retryCount: number             // 已重试次数（上限 10）
}
```

### ClientTask（客户端本地）

```
ClientTask {
  id: string               // "ct-{timestamp}-{counter}"
  serverTask: Task          // 服务端 Task 快照
  status: "pending" | "running" | "completed" | "failed"
  result?: unknown          // 执行结果
  error?: string            // 错误信息
  startedAt?: number        // 开始时间
  completedAt?: number      // 完成时间
}
```

---

## 状态机

### 状态定义

```
TaskStatus = "pending" | "running" | "reviewing" | "completed" | "failed"
```

### 完整状态流转

```
                    submitFrom / handleSubmit
                              │
                              ▼
                          ┌────────┐
                    ┌─────┤ pending │
                    │     └────┬───┘
                    │          │
                    │          │ dispatchSerial / dispatchParallel
                    │          │ （分发给 Member，状态不变）
                    │          │
                    │          ├──────────────────────────────┐
                    │          │                              │
                    │          ▼                              ▼
                    │     ┌─────────┐                  ┌──────────┐
                    │     │ pending │                  │  failed  │
                    │     │(等待操作)│                  │(目标离线) │
                    │     └────┬────┘                  └──────────┘
                    │          │
                    │          │ Member 点击"开始执行" 或
                    │          │ Auto 模式调用 /api/tasks/:id/start
                    │          │
                    │          ▼
                    │     ┌─────────┐
                    │     │ running │◄──────────────────────────┐
                    │     └────┬────┘                           │
                    │          │                                │
                    │     ┌────┴──────┐                         │
                    │     │           │                         │
                    │     ▼           ▼                         │
                    │  执行成功     执行失败                      │
                    │     │           │                         │
                    │     │     ┌──────────┐                   │
                    │     │     │  failed  │                   │
                    │     │     └──────────┘                   │
                    │     │     （Member 失败不重试，直接终止）     │
                    │     │                                    │
                    │     ▼                                    │
                    │  全部 Member 完成                          │
                    │     │                                    │
                    │     ▼                                    │
                    │  ┌───────────────────────┐               │
                    │  │ dispatchToLeader      │               │
                    │  └───────────┬───────────┘               │
                    │              │                            │
                    │     ┌────────┴────────┐                  │
                    │     │                 │                  │
                    │     ▼                 ▼                  │
                    │  Leader 在线      Leader 离线             │
                    │     │                 │                  │
                    │     ▼                 ▼                  │
                    │  ┌──────────┐    ┌───────────┐          │
                    │  │reviewing │    │ completed │          │
                    │  │ (审查中)  │    │(跳过审查)  │          │
                    │  └────┬─────┘    └───────────┘          │
                    │       │                                 │
                    │  ┌────┴─────┐                           │
                    │  │          │                           │
                    │  ▼          ▼                           │
                    │ 通过       驳回                          │
                    │  │          │                            │
                    │  ▼          ▼                            │
                    │  ┌───────────┐  retryCount < 10          │
                    │  │ completed │  resetForRetry ───────────┘
                    │  └───────────┘  （重新分派所有 Member）
                    │       │
                    │       │ retryCount >= 10
                    │       ▼
                    │  ┌──────────┐
                    │  │  failed  │
                    │  └──────────┘
```

### 状态转换表

| 当前状态 | 触发事件 | 新状态 | 执行者 |
|---------|---------|--------|--------|
| (无) | 创建任务 | pending | Server |
| pending | 目标 Member 离线 | failed | Server |
| pending | Member 开始执行 | running | Member (UI 或自动) |
| running | Member 执行失败 | failed | Member (不可重试) |
| running | 所有 Member 完成 + Leader 在线 | reviewing | Server |
| running | 所有 Member 完成 + Leader 离线 | completed | Server |
| reviewing | Leader 审核通过 | completed | Leader |
| reviewing | Leader 驳回 (< 10次) | running | Server (自动重试) |
| reviewing | Leader 驳回 (≥ 10次) | failed | Server |
| reviewing | Leader 断连 | completed | Server |

---

## 分派模式

### 串行模式 (Serial)

```
subscribe: [Alice, Bob, Carol]

  ┌────────────────────────────────────────────────────────────┐
  │  Server                                                     │
  │                                                             │
  │  serialIndex=0 ──dispatch──▶ Alice                          │
  │                               Alice 执行完毕，返回结果         │
  │  serialIndex=1 ──dispatch──▶ Bob                            │
  │                               Bob 执行完毕，返回结果           │
  │  serialIndex=2 ──dispatch──▶ Carol                          │
  │                               Carol 执行完毕，返回结果         │
  │                                                             │
  │  全部完成 ──dispatchToLeader──▶ Leader 审查                   │
  └────────────────────────────────────────────────────────────┘
```

规则：
- `serialIndex` 从 0 开始，每个 Member 完成后 +1
- 当前 Member 离线 → 任务直接 **failed**（不跳到下一个）
- 后续 Member 可在 `task.resources` 中看到前面 Member 的结果
- Member 断连时（执行中断开）→ 跳到下一个 Member，不 failed

### 并行模式 (Parallel)

```
subscribe: [Alice, Bob, Carol]

  ┌────────────────────────────────────────────────────────────┐
  │  Server                                                     │
  │                                                             │
  │  ──dispatch──▶ Alice ──┐                                    │
  │  ──dispatch──▶ Bob  ───┤ 同时执行                             │
  │  ──dispatch──▶ Carol ──┘                                    │
  │                         │                                   │
  │       Alice ✓  Bob ✓  Carol ✓                               │
  │       pendingClients 全部清空                                 │
  │                         │                                   │
  │  全部完成 ──dispatchToLeader──▶ Leader 审查                   │
  └────────────────────────────────────────────────────────────┘
```

规则：
- 所有 Member 同时收到 dispatch，同时执行
- 每个 Member 完成后从 `pendingClients` 中移除
- 离线的 Member 在分派时直接跳过，记一个 error 资源
- `pendingClients.size === 0` 时进入 Leader 审查

---

## 执行模式

### 自动模式 (Auto)

```
Member 收到 dispatch
    │
    ▼
doing() handler 被调用
    │
    ├── 调用 POST /api/tasks/:id/start  （pending → running）
    │
    ├── 组装 Agent 工具集（shell, file_read, file_write, upload_resource 等）
    │
    ├── 启动 ReAct Agent 循环（max 20 步）
    │   │
    │   ├── 每一步：POST /api/ai/agent/reason → AI 推理
    │   ├── AI 返回工具调用 → 本地执行（60s 超时）
    │   ├── AI 返回纯文本 → 作为最终结果
    │   └── 调用 done 工具 → 提交结果
    │
    ├── 成功：POST /api/tasks/:id/result → 服务端 processResult
    │
    └── 失败：POST /api/tasks/:id/result (error) → 任务 failed
```

特点：
- Agent 全自动执行，无需人工干预
- 执行过程通过 `execution-trace` 资源记录
- 执行结果通过 `client-result` 资源提交
- handler 正常返回，Client 自动 `sendResult` 给 Server

### 手动模式 (Manual)

```
Member 收到 dispatch
    │
    ▼
doing() handler 被调用
    │
    ├── 检测到 manual 模式
    │
    └── return new Promise(() => {})  ← 永不 resolve
        │
        │  （handler 挂起，不发送结果给 Server）
        │
        ▼
    Member 在 UI 看到任务卡片：

    ┌─────────────────────────────────┐
    │  任务          [等待中]          │
    │  实现后端文件上传功能...          │
    │                                 │
    │  bob    等待中                   │
    │                                 │
    │  [开始执行]  [上传文件]           │  ← canStart + canUpload
    └─────────────────────────────────┘

    Member 点击 [开始执行]
    │  POST /api/tasks/:id/start  → pending → running
    ▼

    ┌─────────────────────────────────┐
    │  任务          [执行中]          │
    │  实现后端文件上传功能...          │
    │                                 │
    │  bob    执行中                   │
    │                                 │
    │  [上传文件]  [标记完成]           │  ← canComplete + canUpload
    └─────────────────────────────────┘

    Member 点击 [标记完成]
    │  POST /api/tasks/:id/complete  → running → reviewing
    ▼

    ┌─────────────────────────────────┐
    │  任务          [审核中]          │
    │                                 │
    │  bob    已完成                   │  ← 等待 Leader 审核
    └─────────────────────────────────┘
```

特点：
- Member 完全通过 UI 控制任务进度
- doing() handler 永不 resolve，阻止 Client 自动发送结果
- 服务端状态通过 REST API 直接变更（绕过 Envoy 消息协议）

---

## Leader 审查

### 审查流程

```
所有 Member 完成
    │
    ▼
Server: dispatchToLeader()
    │
    ├── Leader 在线
    │   │
    │   ├── task.status = "reviewing"
    │   ├── leaderReviewing = true
    │   ├── 发送 "dispatch" 消息给 Leader
    │   │
    │   ▼
    │   Leader 的 doing() handler 被调用
    │   （检测到 taskStatus === "reviewing"）
    │       │
    │       ├── 收集 Member 的 client-result 资源
    │       ├── 调用 AI 审查：POST /api/ai/task/review
    │       │
    │       ├── 审查通过
    │       │   POST /api/tasks/:id/result (success=true)
    │       │   → Server: finishTask → status = "completed"
    │       │
    │       └── 审查失败
    │           POST /api/tasks/:id/result (success=false)
    │           → Server: resetForRetry 或 status = "failed"
    │
    └── Leader 离线
        │
        └── 直接 finishTask → status = "completed"（跳过审查）
```

### 驳回重试

```
Leader 驳回（retryCount < 10）
    │
    ▼
resetForRetry():
  - retryCount++
  - task.attempt++
  - pendingClients = new Set(task.subscribe)  ← 所有 Member 重新加入
  - serialIndex = 0
  - task.status = "running"
  - 重新 dispatch（串行/并行按原 mode）
```

关键规则：
- Member 执行失败 → 任务直接 **failed**，不重试
- Leader 驳回 → **重试**，所有 Member 重新执行
- 最多重试 10 次，超过后任务 **failed**
- 资源的 `attempt` 字段可用于区分不同轮次的结果

---

## 消息协议

任务相关的 WebSocket 消息类型：

```
┌──────────────────────────────────────────────────────┐
│                任务消息协议                             │
├──────────┬──────────┬────────────────────────────────┤
│ 消息类型  │ 方向      │ 载荷                            │
├──────────┼──────────┼────────────────────────────────┤
│ submit   │ Client→S │ SubmitOptions (content,subscribe,mode) │
│ dispatch │ S→Client │ Task (完整任务对象)                │
│ result   │ Client→S │ { taskId, success, data, error } │
│ task     │ S→All    │ Task (状态变更通知)                │
└──────────┴──────────┴────────────────────────────────┘
```

消息流向：
- `submit`：Leader 发起任务
- `dispatch`：Server 分派给 Member（或审查时发给 Leader）
- `result`：Member 提交结果 / Leader 提交审查结果
- `task`：Server 广播状态变更（发给 createBy + subscribe + watchers）

---

## 异常处理

### Member 断连（执行中）

```
Server: failClientTasks(clientId)

  串行模式：
    Member 断连 → 记录 error 资源 → serialIndex++
    → dispatchSerial 给下一个 Member

  并行模式：
    Member 断连 → 记录 error 资源 → pendingClients.delete
    → 如果 pendingClients 为空 → dispatchToLeader

  Leader 审查时断连：
    → finishTask (completed) — 任务视为完成
```

### Leader 断连（审查中）

```
Leader 断连 → finishTask → status = "completed"
（Member 结果已全部收集，跳过审查直接完成）
```

---

## UI 操作映射

### TaskCard 按钮

| 按钮 | 条件 | API | 状态变化 |
|------|------|-----|---------|
| 开始执行 | `isAssignedToMe && status === "pending"` | `POST /api/tasks/:id/start` | pending → running |
| 上传文件 | `isAssignedToMe && (status === "pending" \|\| "running")` | `POST /api/tasks/:id/resources` | 无变化，添加资源 |
| 标记完成 | `isAssignedToMe && status === "running"` | `POST /api/tasks/:id/complete` | running → reviewing |

### Member 状态显示

| 条件 | 显示 |
|------|------|
| 有 client-result 资源 + 任务 completed | 已完成 |
| 有 client-result 资源 + 任务 failed | 失败 |
| 有 client-result 资源 + 任务 reviewing | 审核中 |
| 无结果 + 任务 completed 或 failed | 跟随任务状态 |
| 无结果 + 任务 pending 或 running | 等待中 |

---

## 持久化

```
~/.envoy/teams/{teamName}/tasks/{taskId}/
  ├── task.json              ← 任务元数据（status, resources, attempt 等）
  └── resources/              ← 任务资源文件
      └── {memberId}.json    ← Member 提交的结果
```

持久化时机：Server 在每个任务事件时触发：
- `task:created` → 创建 task.json
- `task:updated` → 更新 task.json
- `task:completed` → 最终更新
- `task:failed` → 最终更新
