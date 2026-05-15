## Context

当前 Member 的 doing handler return 后，Client 内部自动通过 WS sendResult 发送结果到 Server。需要改为 REST 调用 Manager API，Manager 内部桥接到 Server。

## Goals / Non-Goals

**Goals:**
- Member 通过 REST 提交任务结果
- WS 连接不再有任何主动发送操作

**Non-Goals:**
- 不改变 WS 接收端逻辑
- 不改变 Leader 端行为

## Decisions

### Client autoSendResult 选项

新增 `autoSendResult?: boolean`（默认 true）。false 时 processNext 只更新内部 running 状态，不调 sendResult。

### Server receiveResult 方法

新增 `receiveResult(clientId, taskId, success, data?, error?)`，复用 handleResult 逻辑。

### REST 路由

`POST /api/tasks/:id/result`，body `{ from, success, data?, error? }`，team header 标识团队。
