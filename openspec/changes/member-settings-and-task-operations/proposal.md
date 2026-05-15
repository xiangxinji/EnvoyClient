## Why

当前客户端缺少成员级个人设置能力：Agent 的工作目录固定为 `~/.envoy/workspace/{username}`，无法自定义；任务到达后自动启动 Agent 执行，成员无法选择手动处理。同时任务卡片是纯展示，成员无法在 UI 上手动操作任务状态或上传资源文件。Shell 命令执行没有沙箱约束，Agent 可以通过 `cd` 逃逸到任意目录，存在安全风险。

## What Changes

- 在 MemberSidebar 底部增加固定的设置入口按钮，点击后右侧内容区切换到 SettingsPanel 页面
- SettingsPanel 提供"任务执行模式"（手动/自动接管）和"工作目录"（留空使用默认）两个配置项
- 设置数据按用户存储在 `settings.yml` 的 `users.{username}` 下，通过已有 Tauri get_settings/save_settings 读写
- TaskCard 增加"开始执行"（pending→running）、"上传文件"（调用已有资源 API）、"标记完成"（running→completed）三个操作按钮
- 操作按钮仅对分配给当前用户的任务可见，纯状态变更不触发 Agent 逻辑
- manual 模式下 useTaskExecution 不注册 doing handler，任务到达后仅更新列表不自动执行
- Rust shell_exec 增加严格沙箱：解析命令中的 cd 目标路径，拒绝超出 workspace 的 cd 操作；file_read/file_write 路径校验
- Manager 新增 `/api/tasks/:id/start` 和 `/api/tasks/:id/complete` 两个轻量状态变更 API
- Envoy Server 新增 startTask/completeTask 方法支持状态直接跳转

## Capabilities

### New Capabilities
- `member-settings`: 成员个人设置面板 — 任务执行模式选择、自定义工作目录配置、设置持久化
- `task-manual-operations`: 任务手动操作 — 开始执行、上传文件、标记完成的 UI 操作入口和 API 支持
- `shell-workspace-sandbox`: Shell workspace 沙箱 — 命令级 cd 路径校验、file 操作路径白名单

### Modified Capabilities
- `member-react-agent`: 任务执行模式分支 — manual 模式下不自动注册 doing handler

## Impact

- **前端**: MemberSidebar.vue、TaskCard.vue、ChatView.vue 修改；新增 SettingsPanel.vue 组件
- **Tauri 后端**: lib.rs 的 shell_exec/file_read/file_write 增加沙箱校验逻辑
- **Manager 后端**: messages.ts 新增两个 API 端点
- **Envoy 框架**: server.ts 新增 startTask/completeTask 方法
- **Agent 工具**: tools.ts 的 createShellTool 支持自定义工作目录
- **数据**: settings.yml schema 扩展 `users.{username}.working_directory` 和 `users.{username}.task_execution_mode`
