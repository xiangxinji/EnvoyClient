## ADDED Requirements

### Requirement: User responsibilities field
The user creation form SHALL include a `responsibilities` textarea field. This field stores a free-text description of the member's capabilities and duties.

#### Scenario: Creating a member with responsibilities
- **WHEN** an admin creates a new user with role "member" and fills in responsibilities "前端开发、CI/CD 部署"
- **THEN** the user record SHALL be stored with `responsibilities: "前端开发、CI/CD 部署"` in users.json

#### Scenario: Creating a leader without responsibilities
- **WHEN** an admin creates a new user with role "leader"
- **THEN** the `responsibilities` field SHALL be optional and default to empty string

### Requirement: Responsibilities in member list API
The `GET /api/teams/:name/members` endpoint SHALL include the `responsibilities` field for each member, fetched from users.json by matching username.

#### Scenario: Member has responsibilities
- **WHEN** a member "alice" exists with responsibilities "前端开发" and is in team "CyberCloud"
- **THEN** `GET /api/teams/CyberCloud/members` SHALL return `{ id: "alice", ..., responsibilities: "前端开发" }`

#### Scenario: Member has no responsibilities
- **WHEN** a member exists but responsibilities field is empty or not set
- **THEN** the API SHALL return `responsibilities: ""` for that member
