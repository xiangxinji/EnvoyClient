## ADDED Requirements

### Requirement: Conversations list endpoint
Manager SHALL 提供 `GET /api/messages/conversations` 端点。请求 SHALL 通过 `team` query 参数指定团队，`user` 指定用户。SHALL 返回该用户参与的所有会话摘要，按最后一条消息的 seq 降序排列。

#### Scenario: User with multiple conversations
- **WHEN** GET /api/messages/conversations?team=alpha&user=A，A 与 B 和 C 有对话
- **THEN** 返回 `[{ peer: "B", last_seq: 42, last_message: {...} }, { peer: "C", last_seq: 38, last_message: {...} }]`

#### Scenario: User with no conversations
- **WHEN** GET /api/messages/conversations?team=alpha&user=A，A 没有任何对话
- **THEN** 返回 `[]`

#### Scenario: Peer determination
- **WHEN** 消息 from_user=A, to_user=B，查询 user=A
- **THEN** peer 为 B（对方）

#### Scenario: Task messages included in conversations
- **WHEN** 用户 A 有与 B 的 task 类型消息
- **THEN** 该会话仍出现在 conversations 列表中，last_message 为最后一条消息（无论 type 是 chat 还是 task）

### Requirement: Client derives conversations from sync data
客户端 SHALL 从 sync API 返回的消息中推导会话列表，替代 conversations API。客户端在内存中维护 conversations Map，key 为 peerId，value 为消息数组。会话列表通过遍历 Map 的 keys 生成。

#### Scenario: Build conversation list from sync
- **WHEN** sync API 返回 5 条与 B 的消息和 3 条与 C 的消息
- **THEN** conversations Map 包含 key "B"（5条消息）和 key "C"（3条消息），会话列表显示 B 和 C
