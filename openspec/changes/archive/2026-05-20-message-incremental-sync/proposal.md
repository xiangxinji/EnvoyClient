## Why

当前消息系统存在三个根本缺陷：Manager 仅做无状态中继不存储消息、发送方和接收方对同一条消息看到不同 ID、离线客户端的消息被静默丢弃。这导致无法实现离线补齐和跨设备同步。将 Manager 改造为消息的权威存储中心（SQLite），客户端变为无状态消费者，是解决这些问题的根本路径。

## What Changes

- **BREAKING**: Manager 新增 SQLite (better-sqlite3) 依赖，每个 team 独立数据库文件 (`~/.envoy/teams/{teamName}/messages.db`)，所有聊天消息和任务消息统一存储，per-team seq 递增作为同步 cursor
- **BREAKING**: `POST /api/messages` 改造 — relay 前 INSERT 到 SQLite，分配统一 UUID + seq，返回 `{ id, seq }` 给发送方
- 新增 `GET /api/messages/sync?team=x&after_seq=N` — 按用户拉取增量消息，支持分页
- 新增 `GET /api/messages/conversations?team=x&user=A` — 返回会话列表（peer + last_seq + last_message）
- Manager 任务事件监听 (task:created/updated/completed/failed) 同时写入 messages 表
- 客户端 `useMessages.ts`: `sendChat()` 使用 server 返回的 id/seq；`loadHistory()` 改用 HTTP sync API 替代 Tauri invoke
- 客户端 `useTeamClient.ts`: 连接时调用 sync API 拉取历史，替代本地文件加载
- **BREAKING**: 删除 `src-tauri/src/history.rs` 及 lib.rs 中所有 history 相关 Tauri commands (save_message, load_history, load_all_history, delete_history, export_history, import_history)
- 删除客户端所有 `invoke("save_message")` / `invoke("load_*")` 调用
- `types.ts`: ChatMessage / TaskMessage 统一使用 server 分配的 id + seq

## Capabilities

### New Capabilities
- `message-server-storage`: Manager 侧 per-team SQLite messages 数据库的创建、初始化、写入和查询，包含 per-team seq 递增机制
- `message-sync`: 客户端通过 sync API 拉取增量消息的协议和流程，支持离线补齐和跨设备同步
- `message-conversations`: Manager 侧会话列表查询 API，返回用户参与的所有会话摘要

### Modified Capabilities
- `message-persistence`: 需求从客户端本地文件存储变更为 Manager SQLite 服务端存储，移除所有 Tauri 本地持久化 commands
- `client-rest-messaging`: POST /api/messages 返回值增加 `{ id, seq }`；新增 sync 和 conversations 端点；客户端消息收发流程适配新的服务端 ID

## Impact

- **Manager Backend**: 新增 better-sqlite3 依赖；新增 SQLite 初始化模块；`routes/messages.ts` 改造；`index.ts` 增加任务事件写入逻辑
- **Client Frontend**: `useMessages.ts` 大幅改造；`useTeamClient.ts` 连接流程变更；`types.ts` 类型调整
- **Tauri Backend**: 删除 `history.rs` 整个文件；`lib.rs` 移除 6 个 history commands
- **Manager npm 依赖**: 新增 better-sqlite3 + @types/better-sqlite3
- **数据迁移**: 现有本地历史文件不再使用，Manager 为权威源
