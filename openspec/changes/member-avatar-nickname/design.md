## Context

当前系统用户数据存储在 Manager SQLite `users` 表中，字段为 `username, password_bcrypt, role, responsibilities, capabilities, created_at`。客户端通过 `MemberInfo { id, role, status }` 展示成员，其中 `id` 即 `username`，头像为 `getInitial(username)` 首字母圆圈。Manager 前端 `Users.vue` 展示用户列表时可编辑 responsibilities 和 capabilities。

头像文件将存储在 `~/.envoy/avatars/` 目录下，Manager 后端通过 Hono 静态文件服务对外提供访问。

## Goals / Non-Goals

**Goals:**
- 用户可设置昵称和头像，提升成员辨识度
- Manager 后端和客户端均可编辑昵称和头像
- 头像支持上传图片，服务端验证图片类型并压缩
- 客户端缓存 profile 数据，在成员列表、聊天消息等处展示
- 向后兼容：现有用户 nickname/avatar_url 为空时 fallback 到 username 和首字母头像
- Envoy 框架零改动

**Non-Goals:**
- 不做实时头像/昵称同步（重新进入团队时刷新）
- 不做 Envoy broadcastMembers 改动
- 不做裁剪/编辑头像功能
- 不做头像审核流程

## Decisions

### 1. 头像存储：Manager 本地文件 + 静态服务

**选择**: 上传的图片存到 `~/.envoy/avatars/{username}.{ext}`，Manager 通过 Hono `serveStatic` 在 `/avatars/*` 路径对外提供。DB 中 `avatar_url` 字段存储相对路径 `/avatars/xxx.png`。

**备选**: 存外部 URL（用户自行填写）。不可控且体验差。存 DB BLOB（增加 DB 体积，不灵活）。

**理由**: 本地文件简单可靠，Hono 原生支持 `serveStatic`，客户端通过 Manager URL 直接拼接即可访问。

### 2. 图片压缩：sharp

**选择**: 使用 `sharp` 库在服务端压缩上传图片，限制最大尺寸 512x512，输出 webp 格式。

**备选**: 不压缩（文件可能很大）。前端压缩（不可信）。

**理由**: `sharp` 是 Node.js 图片处理标准库，压缩效果好。统一输出 webp 格式，体积小、兼容性好。服务端压缩保证数据一致性。

### 3. Profile 缓存：客户端内存 Map

**选择**: 新增 `useUserProfile` composable，内部维护 `Map<username, UserProfile>`，连接团队后批量拉取，组件通过 `provide/inject` 访问。

**备选**: 每个组件独立请求（请求泛滥）。localStorage 持久化（增加复杂度，当前不需要）。

**理由**: 单一缓存源，组件按需读取，重新进入团队时刷新即可满足需求。

### 4. DB Migration：ALTER TABLE 增列

**选择**: 在 `initManagerDB()` 中检测 `nickname` 列是否存在，不存在则 `ALTER TABLE users ADD COLUMN`。`avatar_url` 同理。

**理由**: SQLite 支持 ALTER TABLE ADD COLUMN，现有数据自动获得 NULL 默认值，向后兼容，无需数据迁移脚本。

### 5. 批量查询接口

**选择**: 新增 `GET /api/users/profiles?names=user1,user2,user3`，返回 `[{ username, nickname, avatar_url }]`。

**备选**: 复用 `GET /api/users`（返回所有用户含密码哈希等敏感字段，不合适）。逐个查询（N+1 问题）。

**理由**: 批量接口一次请求获取所有在线成员 profile，只暴露必要字段（不含密码）。

### 6. 客户端修改入口：SettingsPanel

**选择**: 在现有 `SettingsPanel.vue` 中增加昵称输入框和头像上传区域。

**理由**: SettingsPanel 已有 per-user 设置能力，增加 profile 编辑是自然延伸。

## Risks / Trade-offs

- **头像文件未清理** → 删除用户时同步删除头像文件；更换头像时覆盖旧文件（按 username 命名）
- **sharp 依赖增加构建体积** → sharp 是原生模块，Tauri 构建不受影响（仅 Manager 后端使用）；开发环境需确保 native binding 可用
- **客户端缓存不实时** → 接受此 trade-off，重新进入团队时刷新。如未来需要实时，可加 WebSocket 事件通知
- **avatar_url 路径依赖 Manager 地址** → 客户端已知 Manager URL，拼接 `managerUrl + avatarUrl` 即可，无额外问题
