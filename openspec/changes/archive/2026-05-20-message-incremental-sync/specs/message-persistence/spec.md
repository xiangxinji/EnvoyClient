## MODIFIED Requirements

### Requirement: Save message to file
系统 SHALL 在每条新消息（发送或接收）到达时，通过 Manager sync API 从服务端获取消息。客户端 SHALL 不再执行本地文件写入。消息存储由 Manager SQLite 负责。

#### Scenario: Chat message received
- **WHEN** 用户发送或收到一条聊天消息
- **THEN** 消息通过 Manager POST /api/messages 写入 SQLite（发送）或通过 WS relay 接收（接收端），客户端仅在内存中维护消息

#### Scenario: Task message received
- **WHEN** 任务状态更新（新建或状态变更）
- **THEN** Manager 将任务消息写入 SQLite messages 表，客户端通过 WS 事件或 sync API 获取

#### Scenario: Connection and history loading
- **WHEN** 客户端连接成功
- **THEN** 系统调用 GET /api/messages/sync 加载历史消息到内存，替代原有的 Tauri load_all_history

## REMOVED Requirements

### Requirement: Export history
**Reason**: 本地文件持久化机制已移除，消息存储在 Manager SQLite 中
**Migration**: 无需导出，Manager 为权威源，任何设备连接即可获取完整历史

### Requirement: Import history
**Reason**: 本地文件持久化机制已移除
**Migration**: 无需导入

### Requirement: Storage path format
**Reason**: 不再使用本地文件存储消息
**Migration**: 消息存储在 Manager 侧 `~/.envoy/teams/{teamName}/messages.db`（per-team 独立数据库）

### Requirement: JSON file format
**Reason**: 不再使用 JSON 文件存储消息
**Migration**: 消息存储在 Manager SQLite messages 表中

### Requirement: Load history on connect
**Reason**: 加载方式从 Tauri invoke 改为 HTTP sync API
**Migration**: 使用 GET /api/messages/sync 替代 invoke("load_all_history")
