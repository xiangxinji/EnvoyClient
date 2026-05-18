## MODIFIED Requirements

### Requirement: User responsibilities field

用户创建表单 SHALL 包含 `responsibilities` 文本字段，存储成员的能力和职责描述。用户数据 SHALL 存储在 `~/.envoy/manager/db/manager.db` 的 `users` 表中，不再使用 `users.json` 文件。

#### Scenario: Creating a member with responsibilities
- **WHEN** admin 创建新用户（role "member"）并填写 responsibilities "前端开发、CI/CD 部署"
- **THEN** 系统 SHALL 对密码做 bcrypt hash 后 INSERT 到 users 表，responsibilities 字段存储为 "前端开发、CI/CD 部署"

#### Scenario: Creating a leader without responsibilities
- **WHEN** admin 创建新用户（role "leader"）
- **THEN** responsibilities 字段 SHALL 可选，默认为空字符串

### Requirement: Responsibilities in member list API

`GET /api/teams/:name/members` 端点 SHALL 包含每个成员的 `responsibilities` 字段，从 SQLite users 表中按 username 查询。

#### Scenario: Member has responsibilities
- **WHEN** member "alice" 在 users 表中 responsibilities 为 "前端开发" 且在 team "CyberCloud" 中
- **THEN** `GET /api/teams/CyberCloud/members` SHALL 返回 `{ id: "alice", ..., responsibilities: "前端开发" }`

#### Scenario: Member has no responsibilities
- **WHEN** member 存在但 responsibilities 字段为空
- **THEN** API SHALL 返回 `responsibilities: ""`
