## MODIFIED Requirements

### Requirement: Save message to file
系统 SHALL 在每条新消息（发送或接收）到达时，通过 Tauri Command 将该消息追加保存到对应的 JSON 文件。频道消息 SHALL 保存到 peerId 为 `"__team__"` 对应的文件。

#### Scenario: Chat message saved
- **WHEN** 用户发送或收到一条聊天消息
- **THEN** 系统调用 Rust `save_message` command，将消息追加到 `~/.envoy/history/${myId}/${peerId}.json`

#### Scenario: Channel message saved
- **WHEN** 用户发送或收到一条频道消息
- **THEN** 系统调用 Rust `save_message` command，将消息追加到 `~/.envoy/history/${myId}/__team__.json`

#### Scenario: Task message saved
- **WHEN** 任务状态更新（新建或状态变更）
- **THEN** 系统调用 Rust `save_message` command，将任务消息追加到对应文件

#### Scenario: First message in conversation
- **WHEN** 与某成员的对话中产生了第一条消息，且对应 JSON 文件不存在
- **THEN** 系统创建 `~/.envoy/history/${myId}/` 目录和 `${peerId}.json` 文件，写入包含该消息的 JSON 数组

### Requirement: Load history on connect
系统 SHALL 在客户端连接成功后，自动加载与所有已知成员的历史记录到内存，包括频道历史。

#### Scenario: Load existing history
- **WHEN** 客户端连接成功
- **THEN** 系统遍历 `~/.envoy/history/${myId}/` 目录下的所有 JSON 文件，将历史消息加载到内存

#### Scenario: Load channel history
- **WHEN** 客户端连接成功，且 `__team__.json` 存在
- **THEN** 系统将频道历史消息加载到 peerId = `"__team__"` 的会话中
