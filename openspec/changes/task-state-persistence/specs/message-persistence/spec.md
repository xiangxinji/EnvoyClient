## MODIFIED Requirements

### Requirement: Save message to file
系统 SHALL 在每条新消息（发送或接收）到达时，通过 Tauri Command 将该消息追加保存到对应的 JSON 文件。

任务状态持久化 SHALL 同时保存调度状态字段（serial_index, pending_clients, leader_reviewing, retry_count）到 SQLite tasks 表。`persistTask()` 函数 SHALL 通过 `server.getTaskState(task.id)` 获取调度状态，传给 `upsertTask()` 一并写入。

#### Scenario: Chat message saved
- **WHEN** 用户发送或收到一条聊天消息
- **THEN** 系统调用 Rust `save_message` command，将消息追加到 `~/.envoy/history/${myId}/${peerId}.json`

#### Scenario: Task message saved with dispatch state
- **WHEN** 任务状态更新（新建或状态变更），触发 `persistTask()`
- **THEN** 系统调用 `server.getTaskState(task.id)` 获取调度状态，将 task 和调度状态一并通过 `upsertTask()` 写入 SQLite tasks 表

#### Scenario: Task state unavailable
- **WHEN** `getTaskState()` 返回 `null`（任务已不在内存 Map 中）
- **THEN** `upsertTask()` 使用默认值（0, '[]', 0, 0）写入调度状态列

#### Scenario: First message in conversation
- **WHEN** 与某成员的对话中产生了第一条消息，且对应 JSON 文件不存在
- **THEN** 系统创建 `~/.envoy/history/${myId}/` 目录和 `${peerId}.json` 文件，写入包含该消息的 JSON 数组

### Requirement: Load history on connect
系统 SHALL 在客户端连接成功后，自动加载与所有已知成员的历史记录到内存。

#### Scenario: Load existing history
- **WHEN** 客户端连接成功
- **THEN** 系统遍历 `~/.envoy/history/${myId}/` 目录下的所有 JSON 文件，将历史消息加载到内存

#### Scenario: No history files
- **WHEN** 客户端首次连接，`~/.envoy/history/${myId}/` 目录不存在
- **THEN** 系统不报错，内存中的消息列表为空
