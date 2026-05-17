## Context

当前聊天消息通过 `POST /api/messages` 发送，写入 SQLite 后通过 Envoy relay 实时转发。消息一旦写入不可变，无撤回机制。消息流经三层：Client UI → Manager REST API → Envoy WebSocket relay。

## Goals / Non-Goals

**Goals:**
- 允许用户右键自己的聊天消息并撤回（硬删除）
- 实时通知对方，对方看到"XX 撤回了一条消息"占位
- 仅限聊天消息，任务消息不支持

**Non-Goals:**
- 撤回时间限制（不做 2 分钟限制）
- 撤回后重新编辑
- 撤回离线期间收到的消息（对方离线时 relay 静默忽略，与现有行为一致）

## Decisions

### 1. 删除策略：硬删除

**选择**: `DELETE FROM messages WHERE id = ?`

**理由**: 用户在 explore 阶段明确选择硬删除。消息从数据库中彻底移除，发送方本地也删除，接收方本地替换为占位。无需新增字段或修改 schema。

**备选**: 软删除（`UPDATE SET revoked_at = ...`），保留数据但增加 schema 复杂度。

### 2. 实时通知：复用 relay + 新 subtype

**选择**: 新增 `chat-revoke` subtype，通过 `team.innerServer.relay()` 发送。

```json
{
  "type": "message",
  "subtype": "chat-revoke",
  "payload": { "msgId": "xxx" }
}
```

**理由**: relay 通道已成熟，新增 subtype 零侵入。接收方 `client.on("message")` 已有分发逻辑，只需新增一个分支处理 `chat-revoke`。

**备选**: 新增独立的 WebSocket 事件类型，但需要修改 Envoy 核心协议，影响范围大。

### 3. 占位类型：新增 RevokedNotice 到 TimelineItem

**选择**: `TimelineItem = ChatMessage | TaskMessage | RevokedNotice`

```typescript
interface RevokedNotice {
  type: "revoked";
  id: string;       // 原消息 id
  seq: number;
  from: string;
  timestamp: number;
}
```

**理由**: 联合类型扩展干净，不影响现有 ChatMessage/TaskMessage 结构。渲染时直接按 type 分支。

**备选**: 在 ChatMessage 上加 `revoked: boolean`，但语义混在一种类型里不够清晰。

### 4. 右键菜单：ChatPanel 层级 Teleport

**选择**: 在 ChatPanel 维护唯一的右键菜单实例，MessageBubble 通过 emit 暴露 contextmenu 事件。

**理由**: 全局一个菜单，状态管理简单，避免每个 bubble 都持有菜单实例。菜单定位基于鼠标坐标，通过 `<Teleport to="body">` 渲染到 body 层级避免被 overflow 裁切。

### 5. API 设计：DELETE /api/messages/:id

**选择**: 标准 REST 语义，`DELETE /api/messages/:id`，需要 `team` header。

```
DELETE /api/messages/:id
Header: team: <teamName>
Body: { from: <callerId> }
```

**理由**: 服务端需验证调用者是消息的发送者（`from_user`），防止越权撤回他人消息。

## Risks / Trade-offs

- **[对方离线时撤回]** → 对方上线后 loadHistory 不会拉到已删除的消息，本地如果已有该消息则保留。这是可接受的——离线期间错过撤回通知是所有即时通讯的常见行为。
- **[并发竞态]** → 对方可能正在阅读该消息时收到撤回通知。前端直接替换数组元素，无需加锁，UI 响应式自动更新。
