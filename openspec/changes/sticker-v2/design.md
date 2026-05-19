## Context

当前贴纸功能将图片存储在客户端本地 `~/.envoy/stickers/{userId}/`，通过 Tauri Rust 命令（`list_stickers`、`add_sticker`、`delete_sticker`）管理。发送时需从本地读取文件再上传到附件 API。这种架构无法跨设备同步，且与项目整体"服务端管理资产"的模式不一致。

项目已有成熟的服务端文件管理模式：附件上传（`POST /api/messages/attachments`）存储在 `~/.envoy/attachments/{team}/{date}/`，下载通过 `GET /api/messages/attachments/:team/:date/:file` 提供静态文件服务。贴纸应复用类似模式。

## Goals / Non-Goals

**Goals:**
- 贴纸由 Manager 后端统一存储和管理，支持跨设备同步
- Manager 提供 REST API：上传、列表、删除贴纸
- 客户端 StickerPanel 完全基于 HTTP API 工作，移除所有 Tauri invoke 调用
- 发送贴纸时直接引用服务端 URL，无需二次上传
- 贴纸按团队维度存储（与消息、附件一致），每个用户在团队内有独立贴纸集

**Non-Goals:**
- 贴纸分组/分类功能（保持扁平列表）
- 贴纸商店或共享贴纸包
- 跨团队贴纸同步
- 贴纸压缩或格式转换

## Decisions

### 1. 贴纸存储路径：按团队按用户隔离

**决策**: `~/.envoy/stickers/{teamName}/{userId}/{uuid}.{ext}`

**理由**: 与附件存储模式（`~/.envoy/attachments/{team}/{date}/`）一致，团队隔离。每个用户的贴纸独立存放。

**备选**: 全局按用户 `~/.envoy/stickers/{userId}/`。放弃原因：与项目其他存储全部按团队隔离的模式不一致。

### 2. 数据库：新增 `stickers` 表

**决策**: 在团队 SQLite 中新增 `stickers` 表：
```sql
CREATE TABLE stickers (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  filename   TEXT NOT NULL,
  size       INTEGER NOT NULL DEFAULT 0,
  mime_type  TEXT NOT NULL DEFAULT 'image/png',
  created_at INTEGER NOT NULL
)
```

**理由**: 与 `cloud_files` 表模式一致，提供元数据查询能力。

### 3. API 路由：挂载在 messages 路由文件中

**决策**: 在 `routes/messages.ts` 中新增贴纸端点，复用已有的 `team` header 鉴权模式。

**端点设计**:
- `POST /api/stickers` — 上传贴纸（multipart/form-data: file + from）
- `GET /api/stickers?user={userId}` — 列出用户的贴纸
- `DELETE /api/stickers/:id?from={userId}` — 删除贴纸（仅允许删除自己的）
- `GET /api/stickers/:team/:userId/:file` — 静态文件下载

**备选**: 独立 `routes/stickers.ts`。放弃原因：贴纸 API 量少（4个端点），且需要 team header 和 teams Map，与 messages 路由共享上下文。

### 4. 贴纸大小限制：1MB

**决策**: 单个贴纸文件不超过 1MB，支持 png/jpg/jpeg/gif/webp 格式。

**理由**: 贴纸是小图片，1MB 足够，防止滥用。

### 5. 发送流程：直接引用 URL

**决策**: 贴纸上传后获得服务端 URL（如 `/api/stickers/{team}/{userId}/{file}`），发送消息时 `sticker` 字段携带 `{ url, name }`。接收端通过 `<img src="...">` 直接加载。

**理由**: 不需要像当前实现那样从本地读文件再上传附件——贴纸已经在服务端了。

### 6. 移除 Tauri stickers 模块

**决策**: 删除 `src-tauri/src/stickers.rs`，从 `lib.rs` 移除 `mod stickers` 和三个命令注册。

**理由**: 贴纸管理完全由 Manager API 处理，不再需要本地文件操作。

## Risks / Trade-offs

- [贴纸删除后消息中的图片链接失效] → 可接受：与附件删除行为一致。贴纸删除是用户主动操作。
- [Manager 离线时无法加载贴纸面板] → 可接受：聊天功能本身依赖 Manager 在线。
- [大量贴纸占用服务端磁盘] → 通过 1MB 大小限制缓解，实际使用中贴纸数量有限。
