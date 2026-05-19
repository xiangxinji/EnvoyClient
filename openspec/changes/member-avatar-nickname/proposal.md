## Why

当前系统成员仅以 username 作为唯一标识和展示名称，头像统一为首字母圆圈。随着团队规模增长，用户难以通过 username 快速辨认成员，缺少个性化展示能力。需要增加头像和昵称字段，提升成员辨识度和使用体验。

## What Changes

- Manager 后端 SQLite users 表新增 `nickname` 和 `avatar_url` 两个字段
- Manager 后端新增头像上传接口（POST `/api/users/:username/avatar`），限制图片类型并服务端压缩
- Manager 后端新增用户 profile 查询/修改接口（GET `/api/users/profiles?names=...`，PATCH `/api/users/:username/profile`）
- Manager 后端新增静态文件服务 `/avatars/*`，头像文件存储在 `~/.envoy/avatars/`
- Manager 后端现有 GET/PATCH `/api/users` 接口返回数据增加 `nickname` 和 `avatar_url` 字段
- Manager 前端 Users.vue 用户列表增加头像列和昵称列，创建/编辑弹窗支持填写昵称和上传头像
- 客户端新增 `useUserProfile` composable，负责批量拉取、缓存和展示用户 profile 数据
- 客户端 MemberSidebar 成员头像从首字母圆圈升级为图片（无头像时 fallback 到首字母）
- 客户端 MessageBubble、ChatPanel header 等处将 username 展示替换为昵称（无昵称时 fallback 到 username）
- 客户端 SettingsPanel 增加修改自己昵称和头像的入口

## Capabilities

### New Capabilities
- `user-profile`: 用户个人资料（头像和昵称）的存储、查询、修改和展示，涵盖 Manager 后端 API、Manager 前端管理界面、客户端缓存与展示三个层面

### Modified Capabilities

## Impact

- **Manager 后端**: `manager-db.ts`（DB schema + CRUD）、`routes/users.ts`（新增路由 + 扩展现有路由）、`index.ts`（静态文件服务）
- **Manager 前端**: `Users.vue`（列表 + 创建/编辑弹窗）、`api.ts`（新增 API 调用）
- **客户端**: 新增 `useUserProfile.ts` composable；修改 `MemberSidebar.vue`、`MessageBubble.vue`、`ChatPanel.vue`、`SettingsPanel.vue` 的展示逻辑
- **Envoy 框架**: 无改动
- **数据兼容**: 现有用户 `nickname` 和 `avatar_url` 默认为空/null，前端 fallback 到 username 和首字母头像，向后兼容
