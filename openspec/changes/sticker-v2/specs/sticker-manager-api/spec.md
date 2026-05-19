## ADDED Requirements

### Requirement: Manager provides sticker upload API
Manager 后端 SHALL 提供 `POST /api/stickers` 端点，接受 multipart/form-data（包含 `file` 和 `from` 字段），将贴纸文件存储到 `~/.envoy/stickers/{teamName}/{userId}/` 目录，并在 SQLite `stickers` 表中记录元数据。端点 SHALL 要求 `team` header。

#### Scenario: Successful sticker upload
- **WHEN** 客户端发送 POST /api/stickers，携带 team header、file（图片文件）和 from（用户ID）
- **THEN** 服务端存储文件到对应目录，插入数据库记录，返回 `{ ok: true, sticker: { id, name, url, size, mimeType } }`

#### Scenario: File too large
- **WHEN** 上传的文件超过 1MB
- **THEN** 返回 413 状态码 `{ error: "Sticker file too large, max 1MB" }`

#### Scenario: Unsupported file type
- **WHEN** 上传的文件不是 png/jpg/jpeg/gif/webp 格式
- **THEN** 返回 400 状态码 `{ error: "Unsupported file type" }`

### Requirement: Manager provides sticker list API
Manager 后端 SHALL 提供 `GET /api/stickers?user={userId}` 端点，返回指定用户在当前团队中的所有贴纸列表。端点 SHALL 要求 `team` header。

#### Scenario: List stickers for user
- **WHEN** 客户端发送 GET /api/stickers?user=alice，携带 team header
- **THEN** 返回 `{ stickers: [{ id, name, url, size, mimeType, createdAt }] }`，按创建时间升序排列

#### Scenario: User has no stickers
- **WHEN** 指定用户没有任何贴纸
- **THEN** 返回 `{ stickers: [] }`

### Requirement: Manager provides sticker delete API
Manager 后端 SHALL 提供 `DELETE /api/stickers/:id?from={userId}` 端点，删除指定贴纸的数据库记录和文件。仅允许删除自己的贴纸。端点 SHALL 要求 `team` header。

#### Scenario: Delete own sticker
- **WHEN** 用户发送 DELETE /api/stickers/{id}?from=alice 且该贴纸属于 alice
- **THEN** 删除数据库记录和文件，返回 `{ ok: true }`

#### Scenario: Delete another user's sticker
- **WHEN** 用户发送 DELETE /api/stickers/{id}?from=alice 但该贴纸属于 bob
- **THEN** 返回 403 状态码 `{ error: "not authorized" }`

#### Scenario: Delete non-existent sticker
- **WHEN** 贴纸 ID 不存在
- **THEN** 返回 404 状态码 `{ error: "sticker not found" }`

### Requirement: Manager provides sticker file download
Manager 后端 SHALL 提供 `GET /api/stickers/:team/:userId/:file` 端点，提供贴纸文件的静态下载服务。

#### Scenario: Download existing sticker
- **WHEN** 请求的贴纸文件存在
- **THEN** 返回文件内容，Content-Type 根据扩展名设置，Content-Disposition 为 inline

#### Scenario: Download non-existent sticker
- **WHEN** 请求的贴纸文件不存在
- **THEN** 返回 404 状态码 `{ error: "file not found" }`

### Requirement: Sticker database table
Manager 后端 SHALL 在团队 SQLite 数据库中维护 `stickers` 表，包含字段：id (TEXT PK), user_id (TEXT), name (TEXT), filename (TEXT), size (INTEGER), mime_type (TEXT), created_at (INTEGER)。表 SHALL 在团队数据库初始化时自动创建。

#### Scenario: Table auto-created on team init
- **WHEN** 新团队数据库初始化
- **THEN** stickers 表自动创建，包含正确的 schema 和索引
