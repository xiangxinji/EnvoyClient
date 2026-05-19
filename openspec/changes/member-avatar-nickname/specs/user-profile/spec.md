## ADDED Requirements

### Requirement: User profile data model
系统 SHALL 在 Manager SQLite users 表中为每个用户维护 `nickname`（TEXT, nullable）和 `avatar_url`（TEXT, nullable）两个字段。`nickname` 为用户自定义展示名称，`avatar_url` 为头像文件的相对路径（如 `/avatars/zhangsan.webp`）。两个字段均可为空。

#### Scenario: 现有用户兼容
- **WHEN** 系统启动时检测到 users 表不存在 `nickname` 或 `avatar_url` 列
- **THEN** 自动执行 ALTER TABLE ADD COLUMN 添加缺失列，默认值为 NULL，不影响现有数据

#### Scenario: 新建用户默认值
- **WHEN** 创建新用户时未提供 nickname 和 avatar_url
- **THEN** 两个字段值均为 NULL

### Requirement: 头像上传接口
Manager 后端 SHALL 提供 `POST /api/users/:username/avatar` 接口，接收 multipart/form-data 格式的图片文件上传。

#### Scenario: 成功上传头像
- **WHEN** 客户端上传一个有效的图片文件（image/jpeg, image/png, image/webp, image/gif）到该接口
- **THEN** 服务端使用 sharp 将图片压缩为最大 512x512 的 webp 格式，保存到 `~/.envoy/avatars/{username}.webp`，更新数据库 `avatar_url` 为 `/avatars/{username}.webp`，返回 `{ avatar_url: "/avatars/{username}.webp" }`

#### Scenario: 上传非图片文件
- **WHEN** 客户端上传一个非图片类型的文件
- **THEN** 返回 400 错误 `{ error: "Only image files are allowed" }`

#### Scenario: 用户不存在
- **WHEN** 上传头像的目标 username 在数据库中不存在
- **THEN** 返回 404 错误 `{ error: "User not found" }`

#### Scenario: 头像覆盖
- **WHEN** 用户已有头像并上传新头像
- **THEN** 新文件覆盖旧文件（同 username 命名），数据库 avatar_url 更新为新路径

### Requirement: 头像文件静态服务
Manager 后端 SHALL 在 `/avatars/*` 路径提供静态文件服务，将请求映射到 `~/.envoy/avatars/` 目录。

#### Scenario: 访问已上传的头像
- **WHEN** 客户端请求 `GET /avatars/zhangsan.webp`
- **THEN** 返回对应的 webp 图片文件

#### Scenario: 访问不存在的头像
- **WHEN** 客户端请求 `GET /avatars/nonexist.webp` 且文件不存在
- **THEN** 返回 404

### Requirement: 批量查询用户 profile
Manager 后端 SHALL 提供 `GET /api/users/profiles?names=user1,user2,user3` 接口，批量返回指定用户的 profile 信息。

#### Scenario: 批量查询成功
- **WHEN** 客户端请求 `GET /api/users/profiles?names=zhangsan,lisi`
- **THEN** 返回 `[{ username: "zhangsan", nickname: "张三", avatar_url: "/avatars/zhangsan.webp" }, { username: "lisi", nickname: null, avatar_url: null }]`，仅包含 nickname 和 avatar_url，不包含密码等敏感字段

#### Scenario: 部分用户不存在
- **WHEN** 查询中包含不存在的 username
- **THEN** 返回已存在的用户的 profile，忽略不存在的用户（不报错）

#### Scenario: 空查询
- **WHEN** 不提供 names 参数或为空
- **THEN** 返回空数组 `[]`

### Requirement: 修改用户 profile
Manager 后端 SHALL 提供 `PATCH /api/users/:username/profile` 接口，允许修改 nickname 和 avatar_url。

#### Scenario: 修改昵称
- **WHEN** 客户端发送 `PATCH /api/users/zhangsan/profile` body `{ nickname: "老张" }`
- **THEN** 更新数据库中该用户的 nickname，返回 `{ ok: true, nickname: "老张", avatar_url: "..." }`

#### Scenario: 清除昵称
- **WHEN** 客户端发送 `{ nickname: "" }` 或 `{ nickname: null }`
- **THEN** 将 nickname 设为 NULL

#### Scenario: 用户不存在
- **WHEN** PATCH 的目标 username 不存在
- **THEN** 返回 404

### Requirement: 现有用户接口扩展
现有 `GET /api/users` 和 `GET /api/users/:username` 的响应 SHALL 包含 `nickname` 和 `avatar_url` 字段。现有 `PATCH /api/users/:username` SHALL 支持修改 `nickname` 字段。

#### Scenario: GET /api/users 包含新字段
- **WHEN** 请求 GET /api/users
- **THEN** 返回的每个用户对象包含 `nickname`（string | null）和 `avatar_url`（string | null）

#### Scenario: PATCH /api/users/:username 修改昵称
- **WHEN** 发送 `PATCH /api/users/zhangsan` body `{ nickname: "张三", responsibilities: "...", capabilities: "..." }`
- **THEN** nickname 与 responsibilities、capabilities 一起更新

### Requirement: Manager 前端用户管理展示
Manager 前端 Users.vue 的用户列表 SHALL 展示头像和昵称列。创建用户弹窗 SHALL 支持填写昵称。编辑用户弹窗 SHALL 支持修改昵称和上传头像。

#### Scenario: 用户列表展示头像和昵称
- **WHEN** 管理员查看用户列表
- **THEN** 每行显示用户头像（有则显示图片，无则显示首字母圆圈）和昵称列（有昵称显示昵称，无则显示 "-"）

#### Scenario: 创建用户时填写昵称
- **WHEN** 管理员在创建用户弹窗中填写昵称字段
- **THEN** 创建成功后该用户的 nickname 被保存

#### Scenario: 编辑用户修改昵称和头像
- **WHEN** 管理员在编辑弹窗中修改昵称或上传新头像
- **THEN** 保存后用户的 nickname 和 avatar_url 更新

### Requirement: 客户端 profile 缓存
客户端 SHALL 通过 `useUserProfile` composable 维护用户 profile 的内存缓存。连接团队后批量拉取所有在线成员的 profile 数据。

#### Scenario: 连接团队后加载 profile
- **WHEN** 用户成功连接到团队
- **THEN** 客户端调用 `GET /api/users/profiles` 批量获取成员 profile，缓存到内存 Map 中

#### Scenario: 获取显示名称
- **WHEN** 组件需要展示用户名称时调用 `getDisplayName(username)`
- **THEN** 若该用户有 nickname 且非空则返回 nickname，否则返回 username

#### Scenario: 获取头像 URL
- **WHEN** 组件需要展示用户头像时调用 `getAvatarUrl(username)`
- **THEN** 若该用户有 avatar_url 则返回 `managerUrl + avatar_url` 的完整 URL，否则返回 null（由组件 fallback 到首字母头像）

### Requirement: 客户端成员列表展示
MemberSidebar 的成员列表 SHALL 展示用户头像和昵称。

#### Scenario: 成员有头像和昵称
- **WHEN** 成员设置了头像和昵称
- **THEN** 成员列表项显示头像图片和昵称，鼠标悬浮显示 username

#### Scenario: 成员无头像和昵称
- **WHEN** 成员未设置头像和昵称
- **THEN** 成员列表项显示首字母圆圈头像和 username（现有行为 fallback）

### Requirement: 客户端聊天消息展示
MessageBubble 的发送者名称 SHALL 展示昵称（fallback 到 username）。消息引用卡片中的发送者名称同理。

#### Scenario: 消息发送者有昵称
- **WHEN** 消息的 from 用户设置了昵称
- **THEN** 消息气泡上方显示昵称而非 username

#### Scenario: 消息发送者无昵称
- **WHEN** 消息的 from 用户未设置昵称
- **THEN** 显示 username（现有行为）

### Requirement: 客户端设置面板修改 profile
SettingsPanel SHALL 提供修改当前用户昵称和头像的入口。

#### Scenario: 修改昵称
- **WHEN** 用户在设置面板中修改昵称输入框并保存
- **THEN** 调用 `PATCH /api/users/:username/profile` 更新昵称，本地缓存同步更新

#### Scenario: 上传头像
- **WHEN** 用户在设置面板中点击头像区域并选择图片文件
- **THEN** 调用 `POST /api/users/:username/avatar` 上传图片，上传成功后本地缓存更新为新头像 URL

### Requirement: 删除用户时清理头像文件
Manager 后端 SHALL 在删除用户时同步删除该用户的头像文件。

#### Scenario: 删除有头像的用户
- **WHEN** 删除一个 avatar_url 不为空的用户
- **THEN** 从 `~/.envoy/avatars/` 中删除对应的头像文件，然后删除数据库记录

#### Scenario: 删除无头像的用户
- **WHEN** 删除一个 avatar_url 为空的用户
- **THEN** 仅删除数据库记录，不进行文件操作
