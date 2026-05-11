## ADDED Requirements

### Requirement: init_brains 命令
系统 SHALL 提供 Tauri 命令 `init_brains(username)`，将 `src-tauri/brains/` 模板目录增量合并到 `~/.envoy/brains/{username}/`。

#### Scenario: 首次初始化
- **WHEN** 用户登录成功，调用 `init_brains("alice")`，且 `~/.envoy/brains/alice/` 不存在
- **THEN** 系统创建 `~/.envoy/brains/alice/` 及其完整子目录结构，复制所有模板文件，返回 `{ brains_dir: "绝对路径" }`

#### Scenario: 增量合并
- **WHEN** 用户再次登录，调用 `init_brains("alice")`，且 `~/.envoy/brains/alice/` 已存在
- **THEN** 系统遍历模板文件，仅复制目标中不存在的文件，保留已有文件不变，返回 `{ brains_dir: "绝对路径" }`

#### Scenario: 用户自建文件不受影响
- **WHEN** 用户在 `~/.envoy/brains/alice/raw/偏好/` 下自建了 `风格.md`，且该文件不在模板中
- **THEN** 调用 `init_brains("alice")` 后，`风格.md` 保持原样

#### Scenario: 模板新增文件自动补充
- **WHEN** app 升级后模板新增了 `skills/code-review.md`，用户已有 brains 目录
- **THEN** 调用 `init_brains` 后，`skills/code-review.md` 被复制到用户目录，其他已有文件不变

### Requirement: 模板目录打包
系统 SHALL 通过 Tauri `bundle.resources` 将 `src-tauri/brains/` 目录打包到应用中，dev 和 build 模式下均可正确访问。

#### Scenario: dev 模式路径解析
- **WHEN** 在 dev 模式下运行 `npm run tauri:dev`
- **THEN** `init_brains` 通过 `resource_dir()` 正确定位到 `src-tauri/brains/` 模板

#### Scenario: build 模式路径解析
- **WHEN** 运行打包后的应用
- **THEN** `init_brains` 通过 `resource_dir()` 正确定位到安装包内的 `brains/` 资源目录

### Requirement: 登录后触发初始化
前端 SHALL 在用户认证成功后、显示团队选择前调用 `init_brains`。

#### Scenario: 登录成功触发
- **WHEN** 用户输入用户名密码，`handleLogin` 中 `/api/auth` 认证成功
- **THEN** 前端调用 `invoke("init_brains", { username })`，完成后继续加载团队列表

#### Scenario: 非浏览器环境
- **WHEN** 应用运行在浏览器模式（非 Tauri 环境）
- **THEN** `init_brains` 调用被 `safeInvoke` 静默跳过，不阻塞登录流程

### Requirement: 空目录 Git 跟踪
`src-tauri/brains/` 下的空目录 SHALL 包含 `.gitkeep` 文件以确保 Git 跟踪。

#### Scenario: 克隆后目录结构完整
- **WHEN** 新开发者克隆仓库并运行应用
- **THEN** `src-tauri/brains/raw/偏好/`、`raw/日志/`、`skills/` 目录均存在
