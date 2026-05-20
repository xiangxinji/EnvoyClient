## Context

当前消息系统采用客户端本地文件持久化方案（`~/.envoy/history/{userId}/{peerId}.json`），Manager 作为纯 WebSocket 中继不存储消息。这导致三个问题：离线消息丢失、跨设备无历史、发送方和接收方消息 ID 不一致。

本次改造将 Manager 升级为消息权威存储中心（SQLite），客户端变为无状态消费者，必须连接 Manager 才能使用。

## Goals / Non-Goals

**Goals:**
- Manager 侧使用 SQLite 存储所有 chat 和 task 消息，per-team seq 递增
- 客户端连接时通过 sync API 拉取增量消息，支持离线补齐和跨设备同步
- 统一消息 ID（server 分配 UUID + seq），消除 sender/recipient ID 不一致
- 提供会话列表 API，替代客户端从文件目录推导会话列表
- 客户端移除所有本地消息持久化逻辑

**Non-Goals:**
- 消息加密存储（本次不做 E2E encryption）
- 消息搜索功能（后续可基于 SQLite 实现）
- 服务端 unread 统计（客户端自己计算）
- 历史数据迁移工具（本地历史文件不再使用，Manager 为权威源）

## Decisions

### D1: SQLite (better-sqlite3) 作为消息存储

**选择**: better-sqlite3
**替代方案**:
- JSON 文件存储 — 与现有模式一致，但消息量级下全文件读写性能差，无法高效做范围查询
- sql.js (WASM SQLite) — 纯 JS 无 native 编译问题，但性能不如 native

**理由**: 消息同步是索引查询问题（`WHERE (from_user=? OR to_user=?) AND seq > ?`），SQLite 天然适合。better-sqlite3 是同步 API，与 Manager 现有的同步代码风格匹配。虽然引入 native 依赖增加打包复杂度，但 Manager 是独立 Node.js 进程，不嵌入 Tauri 打包。

### D2: Per-team seq 递增作为同步 cursor

**选择**: 每个 team 独立 SQLite 数据库，seq 在 team 内 AUTOINCREMENT
**替代方案**:
- 全局 seq 单库 — 客户端只需一个 watermark，但所有团队共享一个 db 文件，隔离性差
- 按 conversation 独立 seq — 最细粒度，但复杂度高
- 时间戳 cursor — 实现简单但有时钟偏移问题

**理由**: 客户端同一时刻只连一个 team，per-team seq 更自然。每个 team 独立 db 文件提供数据隔离，单个 db 文件规模可控。查询通过 `(from_user=? OR to_user=?) AND seq > ?` 过滤即可，无需 team 条件。

### D3: messages 表统一存储 chat 和 task

**选择**: 单表，`type` 字段区分 `'chat'` | `'task'`，`extra` JSON 存扩展字段
**替代方案**:
- 分表 (messages + task_messages) — 更规范的范式设计，但增加 JOIN 和维护复杂度

**理由**: 客户端 TimelineItem 就是 ChatMessage | TaskMessage 的联合类型，统一存储与前端模型一致，同步 API 一次查询返回所有类型的消息。

### D4: 会话列表 API 返回轻量摘要

**选择**: `GET /api/messages/conversations` 返回 peer 列表 + last_seq + last_message，unread 客户端自己算
**理由**: 服务端不维护用户的"已读位置"状态，客户端根据 sync 拉取的 seq 和自己的内存状态计算 unread。这避免了服务端 per-user per-conversation 的状态管理。

### D5: 移除 Tauri 本地持久化

**选择**: 完全删除 history.rs 及相关 commands，不做本地缓存
**理由**: 用户已明确"不连 Manager 就不能用"的设计约束。客户端无状态化简化了整体架构，无需处理本地和服务端数据的冲突。

### D6: SQLite 文件位置

**选择**: `~/.envoy/teams/{teamName}/messages.db`（per-team 独立数据库）
**理由**: 与现有 `~/.envoy/teams/{teamName}/` 目录结构一致（meta.json、tasks/ 已在此目录下）。每个 team 独立 db 提供数据隔离，Manager 在创建/恢复 team 时初始化对应的数据库。

## Risks / Trade-offs

- **[better-sqlite3 native 编译]** → Manager 是独立 Node.js 进程，不嵌入 Tauri 打包流程，只需 `npm install` 即可。风险可控。
- **[per-team db 文件数量]** → 每个团队一个 db 文件，团队数量通常为个位数到两位数，文件管理无压力。
- **[Manager 单点故障]** → Manager 挂了客户端完全不可用。但这是现有架构的既有约束（认证、团队、AI 都依赖 Manager），不是新引入的风险。
- **[任务事件双重写入]** → 任务事件同时写入现有 task.json 文件和 messages 表。task.json 用于任务详情展示，messages 表用于消息同步。两份数据的 `extra` 字段可能存在冗余，但各自服务不同场景。
- **[现有本地历史不可迁移]** → 用户本地 `~/.envoy/history/` 下的历史不会被自动导入 Manager。这是 explicit trade-off — 新架构以 Manager 为起点，旧数据保留在磁盘但不参与同步。
