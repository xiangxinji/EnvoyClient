## 1. Manager 后端 - 数据模型与 Migration

- [x] 1.1 在 `manager-db.ts` 的 `initManagerDB()` 中添加 ALTER TABLE 逻辑：检测 users 表是否存在 `nickname` 和 `avatar_url` 列，不存在则 ADD COLUMN（TEXT, 默认 NULL）
- [x] 1.2 在 `manager-db.ts` 的 `UserRecord` interface 中添加 `nickname: string | null` 和 `avatar_url: string | null` 字段
- [x] 1.3 更新 `listUsers()`、`getUser()`、`upsertUser()` 函数的 SQL 和映射逻辑，包含新字段
- [x] 1.4 安装 sharp 依赖（`cd manager/server && npm install sharp`）

## 2. Manager 后端 - 头像上传接口

- [x] 2.1 在 `routes/users.ts` 中新增 `POST /api/users/:username/avatar` 路由，接收 multipart/form-data，验证图片类型（image/jpeg, image/png, image/webp, image/gif），用 sharp 压缩为 512x512 webp，保存到 `~/.envoy/avatars/{username}.webp`，更新 DB avatar_url
- [x] 2.2 在 `manager/index.ts` 中配置 Hono serveStatic，将 `/avatars/*` 映射到 `~/.envoy/avatars/` 目录

## 3. Manager 后端 - Profile 查询与修改接口

- [x] 3.1 在 `routes/users.ts` 中新增 `GET /api/users/profiles?names=...` 批量查询路由，仅返回 `{ username, nickname, avatar_url }`
- [x] 3.2 在 `routes/users.ts` 中新增 `PATCH /api/users/:username/profile` 路由，支持修改 nickname（空字符串或 null 清除为 NULL）
- [x] 3.3 扩展现有 `GET /api/users` 响应，包含 `nickname` 和 `avatar_url` 字段
- [x] 3.4 扩展现有 `PATCH /api/users/:username`，支持 `nickname` 字段更新
- [x] 3.5 扩展现有 `DELETE /api/users/:username`，删除用户时同步清理 `~/.envoy/avatars/` 中的头像文件

## 4. Manager 前端 - 用户管理页面

- [x] 4.1 在 `manager/web/src/api.ts` 的 `UserInfo` interface 中添加 `nickname` 和 `avatar_url` 字段，新增 `uploadAvatar`、`getProfiles`、`updateProfile` API 方法
- [x] 4.2 修改 `Users.vue` 用户列表：添加头像列（有头像显示 img，无则显示首字母圆圈）和昵称列
- [x] 4.3 修改 `Users.vue` 创建用户弹窗：添加昵称输入框，POST 时传入 nickname
- [x] 4.4 修改 `Users.vue` 编辑弹窗：添加昵称输入框和头像上传，保存时调用 profile 更新接口

## 5. 客户端 - Profile 缓存 Composable

- [x] 5.1 新建 `src/composables/useUserProfile.ts`，定义 `UserProfile { username, nickname, avatar_url }` 类型，实现 profiles Map、fetchProfiles、getDisplayName、getAvatarUrl、updateMyProfile、uploadMyAvatar 方法
- [x] 5.2 在 `useTeamClient.ts` 连接成功后调用 `fetchProfiles` 批量拉取成员 profile
- [x] 5.3 通过 `provide/inject`（或 `teamClientContext.ts`）将 profile 服务暴露给子组件

## 6. 客户端 - UI 展示替换

- [x] 6.1 修改 `MemberSidebar.vue`：成员头像区域从纯首字母改为 `<img>` + fallback 首字母，成员名称显示昵称 + title 显示 username
- [x] 6.2 修改 `MessageBubble.vue`：sender-name 从 `message.from` 改为 `getDisplayName(message.from)`
- [x] 6.3 修改 `ChatPanel.vue`：header 中对方名称使用 `getDisplayName`，引用卡片中 sender 使用昵称
- [x] 6.4 修改 `SettingsPanel.vue`：添加昵称输入框（保存调用 PATCH profile）和头像上传区域（调用 POST avatar）

## 7. 客户端 - API 层

- [x] 7.1 在 `src/api.ts` 中新增 `fetchProfiles(names)` 和 `updateProfile(username, data)` 和 `uploadAvatar(username, file)` 方法
