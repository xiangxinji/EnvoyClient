## 1. Rust Shell/File 沙箱

- [x] 1.1 在 shell_exec 中实现命令分割（按 &&、||、|、;）和 cd 路径提取正则
- [x] 1.2 实现 canonicalize 校验逻辑：cd 目标必须以 workspace 为前缀，否则返回错误
- [x] 1.3 为 shell_exec 添加命令前 prepend cd（Windows: `cd /d {workspace} &&`，Unix: `cd {workspace} &&`）
- [x] 1.4 为 file_read 和 file_write 添加 canonicalize 路径校验，超出 workspace 返回错误
- [x] 1.5 shell_exec 支持自定义 working_dir 参数传入（来自 settings.yml 的自定义工作目录）

## 2. Envoy Server 状态方法

- [x] 2.1 在 envoy/packages/server/server.ts 新增 `startTask(taskId)` 方法：pending → running 状态跳转 + 广播通知
- [x] 2.2 新增 `completeTask(taskId, from, data?)` 方法：running → completed 状态跳转 + 广播通知 + 持久化

## 3. Manager API 端点

- [x] 3.1 在 manager/server/routes/messages.ts 新增 `POST /api/tasks/:id/start` 路由：校验任务存在 + 状态为 pending → 调用 server.startTask
- [x] 3.2 新增 `POST /api/tasks/:id/complete` 路由：校验任务存在 + 状态为 running → 调用 server.completeTask

## 4. 设置数据层

- [x] 4.1 创建 `src/composables/useMemberSettings.ts` composable：读取/保存 settings.yml 中 users.{username} 的 working_directory 和 task_execution_mode
- [x] 4.2 在 teamClientContext 中暴露 settings 响应式状态和执行模式

## 5. SettingsPanel 组件

- [x] 5.1 创建 `src/components/SettingsPanel.vue`：任务执行模式 Select（手动/自动接管）+ 工作目录 Input + 返回按钮
- [x] 5.2 实现保存逻辑：变更时调用 useMemberSettings 保存到 settings.yml
- [x] 5.3 实现加载逻辑：打开时从 settings.yml 读取当前值填充表单

## 6. MemberSidebar 集成

- [x] 6.1 在 MemberSidebar.vue 底部添加固定设置按钮（齿轮图标），点击 emit select('__settings__')
- [x] 6.2 在 ChatView.vue 中处理 `selectedPeer === '__settings__'` 时渲染 SettingsPanel

## 7. TaskCard 操作按钮

- [x] 7.1 TaskCard 新增操作栏区域：根据任务状态和当前用户 ID 显示对应按钮
- [x] 7.2 实现"开始执行"按钮：POST /api/tasks/:id/start，成功后更新本地任务状态
- [x] 7.3 实现"上传文件"按钮：弹出文件选择器，选择后 POST /api/tasks/:id/resources
- [x] 7.4 实现"标记完成"按钮：弹出确认对话框，确认后 POST /api/tasks/:id/complete

## 8. 任务执行模式分支

- [x] 8.1 修改 useTaskExecution.registerHandler：在 doing handler 中读取 task_execution_mode，manual 模式不调用 handleMemberExecution
- [x] 8.2 修改 tools.ts 的 createShellTool：从 settings 读取自定义 working_directory，传入 shell_exec

## 9. 样式与双主题

- [x] 9.1 SettingsPanel 样式：使用 CSS 变量，确保 dark/light 双色逻辑
- [x] 9.2 TaskCard 操作按钮样式：使用 CSS 变量，确保 dark/light 双色逻辑
- [x] 9.3 MemberSidebar 底部设置按钮样式：固定定位、分隔线、CSS 变量双色
