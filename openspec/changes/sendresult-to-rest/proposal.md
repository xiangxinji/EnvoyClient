## Why

sendResult 是最后一个主动使用 WS 发送的操作。将其迁移到 REST，使客户端所有"发送"操作统一走 REST + team header 模式，WS 连接彻底变为纯被动监听。

## What Changes

- Envoy Client 新增 `autoSendResult` 选项（默认 true），设为 false 时 processNext 不自动 WS 发送结果
- Envoy Server 新增 `receiveResult(clientId, taskId, success, data?, error?)` 公开方法
- Manager 新增 `POST /api/tasks/:id/result` 路由
- useTeamClient 的 doing handler 改为 REST 提交结果，Client 配置 `autoSendResult: false`

## Capabilities

### New Capabilities
- `client-rest-messaging`: 扩展已有 capability，增加任务结果 REST 提交

### Modified Capabilities

## Impact

- **Envoy Client/Server**: 各加一个方法/选项，向后兼容（默认行为不变）
- **Manager routes/messages.ts**: 新增一个路由
- **useTeamClient.ts**: doing handler 改为 REST 提交
