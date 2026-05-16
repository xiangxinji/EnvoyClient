## ADDED Requirements

### Requirement: Per-team SQLite database initialization
Manager SHALL 为每个 team 维护独立的 SQLite 数据库文件 `~/.envoy/teams/{teamName}/messages.db`。若文件不存在 SHALL 自动创建。SHALL 创建 messages 表，schema 如下：

```
messages (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT UNIQUE NOT NULL,
  type       TEXT NOT NULL DEFAULT 'chat',
  subtype    TEXT,
  from_user  TEXT NOT NULL,
  to_user    TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  extra      TEXT,
  created_at INTEGER NOT NULL
)
```

SHALL 创建索引 `idx_sync ON messages(seq)` 和 `idx_conversation ON messages(from_user, to_user)`。seq 在每个 team 内独立递增。

#### Scenario: Team created
- **WHEN** 创建新团队 alpha，目录 `~/.envoy/teams/alpha/` 已存在
- **THEN** 创建 `~/.envoy/teams/alpha/messages.db`、messages 表和索引

#### Scenario: Team restored on startup
- **WHEN** Manager 启动，恢复已有团队 alpha
- **THEN** 打开 `~/.envoy/teams/alpha/messages.db`，若不存在则创建

### Requirement: Insert chat message on relay
`POST /api/messages` 路由 SHALL 在调用 `team.innerServer.relay()` 之前，将消息 INSERT 到该 team 对应的 messages 表。SHALL 为消息分配 UUID (id) 并获取 per-team 自增 seq。SHALL 将 `{ id, seq }` 返回给调用方。

#### Scenario: Send chat message
- **WHEN** POST /api/messages body `{ from: "A", to: "B", text: "hello" }`，header `team: alpha`
- **THEN** INSERT 到 `~/.envoy/teams/alpha/messages.db`（type='chat', from_user='A', to_user='B', content='hello'），relay 给 B，返回 `{ ok: true, id: "uuid-xxx", seq: 42 }`

#### Scenario: Send to offline user
- **WHEN** POST /api/messages 目标用户 B 不在线
- **THEN** 消息仍 INSERT 到 messages 表，relay 静默跳过（不报错），返回 `{ ok: true, id: "uuid-xxx", seq: 43 }`

### Requirement: Insert task message on task events
Manager SHALL 在 task:created / task:updated / task:completed / task:failed 事件触发时，将任务消息 INSERT 到该 team 对应的 messages 表（type='task'），extra 字段存储 `{ taskId, status, subscribe, resources }`。

#### Scenario: Task created
- **WHEN** 团队 alpha 中创建新任务 task-001，subscribe: ["member1"]
- **THEN** INSERT 到 `~/.envoy/teams/alpha/messages.db`（type='task', from_user=创建者, to_user='member1', extra 包含 taskId 和 status）

#### Scenario: Task completed
- **WHEN** 任务 task-001 完成，member1 提交结果
- **THEN** INSERT messages 表（type='task', status='completed'）

### Requirement: Database module exports
SHALL 导出 `initTeamDatabase(teamDir: string)` 和 `insertMessage(teamName, msg)` 方法。`insertMessage` SHALL 接受消息对象，INSERT 到对应 team 的数据库并返回 `{ id, seq }`。SHALL 维护 team name 到 database 实例的映射。

#### Scenario: insertMessage call
- **WHEN** 调用 `insertMessage("alpha", { type: "chat", from_user: "A", to_user: "B", content: "hi" })`
- **THEN** 返回 `{ id: "<uuid>", seq: <number> }`，记录已写入 `~/.envoy/teams/alpha/messages.db`
