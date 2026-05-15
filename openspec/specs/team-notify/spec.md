## ADDED Requirements

### Requirement: Broadcast member join
Team 服务端 SHALL 在 Leader 或 Member 连接并发送 team:join 消息后，向所有在线客户端广播更新后的成员列表。

#### Scenario: Leader joins
- **WHEN** 一个 Leader 客户端连接并发送 team:join 消息
- **THEN** Team 服务端向所有在线客户端发送 notify 消息，subtype 为 "team:members"，payload 包含完整成员列表 [{id, role, status}]

#### Scenario: Member joins
- **WHEN** 一个 Member 客户端连接并发送 team:join 消息
- **THEN** Team 服务端向所有在线客户端发送 notify 消息，subtype 为 "team:members"，payload 包含更新后的成员列表

### Requirement: Broadcast member leave
Team 服务端 SHALL 在客户端断开连接时，向剩余在线客户端广播更新后的成员列表。

#### Scenario: Member disconnects
- **WHEN** 某客户端断开连接（WebSocket close 或心跳超时）
- **THEN** Team 服务端从 roles Map 中移除该客户端，并向所有剩余在线客户端发送 notify 消息，subtype 为 "team:members"，payload 包含更新后的成员列表

### Requirement: Member list data format
广播的成员列表 payload SHALL 为数组格式，每个元素包含 id（string）、role（"leader" | "member"）、status（"online"）。

#### Scenario: Payload structure
- **WHEN** Team 广播 team:members 消息
- **THEN** payload 为 { members: [{ id: "alice", role: "leader", status: "online" }, { id: "bob", role: "member", status: "online" }] }

### Requirement: Client handles member list update
useTeamClient composable SHALL 监听 notify 事件中 subtype 为 "team:members" 的消息，更新本地成员列表状态。

#### Scenario: Composable updates member list
- **WHEN** composable 收到 subtype 为 "team:members" 的 notify 消息
- **THEN** 本地 members ref 更新为消息中的成员列表
