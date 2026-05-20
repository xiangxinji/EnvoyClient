## ADDED Requirements

### Requirement: Manager Database Initialization

系统 SHALL 在 `~/.envoy/manager/db/manager.db` 路径创建 SQLite 数据库，包含 `admin`、`ai_presets`、`ai_scenes`、`users` 四张表。数据库 SHALL 使用 WAL 模式。首次启动时 admin 表为空，SHALL 自动插入默认管理员账号（username: `admin`，password bcrypt hash of `admin123`）。

#### Scenario: 首次启动初始化
- **WHEN** Manager 服务启动且 `manager.db` 不存在
- **THEN** 系统 SHALL 创建数据库文件和四张表，插入默认 admin 账号，日志输出默认凭据信息

#### Scenario: 后续启动
- **WHEN** Manager 服务启动且 `manager.db` 已存在
- **THEN** 系统 SHALL 打开数据库连接，确保表存在（CREATE IF NOT EXISTS），不覆盖已有数据

#### Scenario: 启动顺序
- **WHEN** Manager 服务执行启动流程
- **THEN** `initManagerDB()` SHALL 在 crypto 初始化和 settings 初始化之前执行

### Requirement: Admin Table CRUD

`admin` 表 SHALL 存储单行管理员配置（id=1, username, password_bcrypt）。系统 SHALL 提供 `getAdminConfig()`、`updateAdmin()`、`verifyAdmin()` 函数，直接查询和更新数据库。

#### Scenario: 获取管理员配置
- **WHEN** 调用 `getAdminConfig()`
- **THEN** SHALL 从 admin 表查询 id=1 的行并返回 `{ username, password }` 对象

#### Scenario: 更新管理员凭据
- **WHEN** 调用 `updateAdmin(username, rawPassword)`
- **THEN** SHALL 对密码做 bcrypt hash，UPDATE admin 表 id=1 的行

#### Scenario: 验证管理员登录
- **WHEN** 调用 `verifyAdmin(username, password)`
- **THEN** SHALL 从 DB 查询 admin 记录，比对 username 和 bcrypt hash，返回 boolean

### Requirement: AI Presets Table CRUD

`ai_presets` 表 SHALL 存储模型预设记录。系统 SHALL 提供 `getPreset()`、`getDefaultPreset()`、`createPreset()`、`updatePreset()`、`deletePreset()`、`setDefaultPreset()` 函数，每次操作直接查 DB。

#### Scenario: 获取预设列表
- **WHEN** 调用 `getAIConfig()` 或路由需要预设列表
- **THEN** SHALL 查询 `SELECT * FROM ai_presets` 返回完整列表

#### Scenario: 创建预设
- **WHEN** 调用 `createPreset(data)`
- **THEN** SHALL 生成 UUID 作为 id，INSERT 到 ai_presets 表

#### Scenario: 设为默认预设
- **WHEN** 调用 `setDefaultPreset(id)`
- **THEN** SHALL 在单个事务中：将所有预设 is_default 设为 0，再将指定预设 is_default 设为 1

#### Scenario: 删除预设检查场景绑定
- **WHEN** 调用 `deletePreset(id)`
- **THEN** SHALL 先查询 ai_scenes 表中是否有引用该 preset_id 的记录，若有则抛出错误

### Requirement: AI Scenes Table CRUD

`ai_scenes` 表 SHALL 以 `scene_type` 为主键存储场景配置。系统 SHALL 提供 `getScenes()`、`updateScenes()` 函数。

#### Scenario: 获取场景配置
- **WHEN** 调用 `getScenes()`
- **THEN** SHALL 查询 `SELECT * FROM ai_scenes`，返回 `Partial<Record<SceneType, SceneConfig>>`

#### Scenario: 更新场景配置
- **WHEN** 调用 `updateScenes(scenes)`
- **THEN** SHALL 验证所有 preset_id 引用有效后，UPSERT 到 ai_scenes 表

### Requirement: Resolve Scene Model

系统 SHALL 提供 `resolveForScene(sceneType)` 函数，查询 ai_scenes 表获取场景配置，再查询 ai_presets 表获取对应预设，组装 AI SDK model 实例。

#### Scenario: 场景有明确预设
- **WHEN** `resolveForScene("chat")` 且 ai_scenes 中 chat 绑定了 preset_id
- **THEN** SHALL 查询该 preset，用其 provider/apiKey/model 构建 `LanguageModelV1` 实例

#### Scenario: 场景无预设，回退默认
- **WHEN** `resolveForScene("agent")` 且 ai_scenes 中无 agent 记录
- **THEN** SHALL 查询 `is_default = 1` 的预设作为回退

#### Scenario: 无任何预设
- **WHEN** `resolveForScene("chat")` 且 ai_presets 表为空
- **THEN** SHALL 抛出错误 "AI not configured"

### Requirement: Users Table CRUD

`users` 表 SHALL 以 `username` 为主键存储用户记录。系统 SHALL 提供 `loadUsers()`、`saveUsers()`（批量写）、`hashPassword()`、`authenticate()` 函数。

#### Scenario: 用户列表查询
- **WHEN** 调用 `loadUsers()`
- **THEN** SHALL 查询 `SELECT * FROM users` 返回 `UserRecord[]`

#### Scenario: 用户认证
- **WHEN** 调用 `authenticate(username, password)`
- **THEN** SHALL 从 DB 查询指定 username，比对 bcrypt hash，返回匹配的 UserRecord 或 null

#### Scenario: 创建用户
- **WHEN** 路由层调用 saveUsers 写入新用户列表
- **THEN** SHALL 对密码做 bcrypt hash 后 INSERT 到 users 表
