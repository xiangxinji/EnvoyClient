## ADDED Requirements

### Requirement: Save message to file
系统 SHALL 在每条新消息（发送或接收）到达时，通过 Tauri Command 将该消息追加保存到对应的 JSON 文件。

#### Scenario: Chat message saved
- **WHEN** 用户发送或收到一条聊天消息
- **THEN** 系统调用 Rust `save_message` command，将消息追加到 `~/.envoy/history/${myId}/${peerId}.json`

#### Scenario: Task message saved
- **WHEN** 任务状态更新（新建或状态变更）
- **THEN** 系统调用 Rust `save_message` command，将任务消息追加到对应文件

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

### Requirement: Export history
系统 SHALL 支持将指定对话的历史记录导出为 JSON 文件到用户选择的路径。

#### Scenario: Export a conversation
- **WHEN** 用户触发导出操作，选择目标路径 `/path/to/backup/bob.json`
- **THEN** 系统将 `~/.envoy/history/${myId}/${peerId}.json` 的内容复制到用户指定路径

### Requirement: Import history
系统 SHALL 支持从用户指定的 JSON 文件导入历史记录，合并到现有对话中。

#### Scenario: Import a conversation
- **WHEN** 用户选择导入 `/path/to/backup/bob.json`
- **THEN** 系统读取该文件内容，与现有记录按 timestamp 合并去重，写回 `~/.envoy/history/${myId}/${peerId}.json`

#### Scenario: Import with duplicate messages
- **WHEN** 导入的文件包含已存在的消息（相同 id）
- **THEN** 系统按 id 去重，保留最新的记录

### Requirement: Storage path format
存储路径 SHALL 为 `~/.envoy/history/${myId}/${peerId}.json`，其中 `~` 为用户根目录。

#### Scenario: Path on Windows
- **WHEN** 当前用户为 Administrator，myId 为 alice，peerId 为 bob
- **THEN** 文件路径为 `C:\Users\Administrator\.envoy\history\alice\bob.json`

### Requirement: JSON file format
历史文件 SHALL 为 JSON 数组格式，每个元素包含消息的完整信息（type、id、from、to/text/content、timestamp 等）。

#### Scenario: File content structure
- **WHEN** 保存一条聊天消息和一条任务消息
- **THEN** JSON 文件内容为 `[{ "type": "chat", ... }, { "type": "task", ... }]`
