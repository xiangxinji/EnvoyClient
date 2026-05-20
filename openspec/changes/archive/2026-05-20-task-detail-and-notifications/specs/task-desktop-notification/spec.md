## ADDED Requirements

### Requirement: Tauri notification plugin integration
系统 SHALL 集成 `tauri-plugin-notification`，使客户端能够发送系统桌面通知。

#### Scenario: 插件安装和注册
- **WHEN** 应用启动
- **THEN** Tauri notification 插件 SHALL 被正确注册（Cargo.toml 依赖、lib.rs 插件初始化、capabilities 权限）

#### Scenario: 浏览器环境跳过
- **WHEN** 客户端运行在浏览器环境（非 Tauri）
- **THEN** 通知功能 SHALL 静默跳过，不报错

### Requirement: Task dispatched notification
当任务被分派给成员时，系统 SHALL 向被分派的成员发送桌面通知。

#### Scenario: 收到任务分派
- **WHEN** Member 收到任务分派（状态变为 dispatched）
- **THEN** 系统 SHALL 发送桌面通知，标题为"新任务"，内容为任务描述前 30 字符

### Requirement: Task completed notification
当任务完成时，系统 SHALL 向任务创建者和所有订阅者发送桌面通知。

#### Scenario: 任务完成
- **WHEN** 任务状态变为 completed
- **THEN** 系统 SHALL 向 task.createBy 和所有 task.subscribe 成员发送桌面通知，标题为"任务完成"

#### Scenario: Leader 审核通过完成任务
- **WHEN** Leader 审核通过任务，任务状态变为 completed
- **THEN** 系统 SHALL 向所有订阅者发送完成通知

### Requirement: Task failed notification
当任务失败时，系统 SHALL 向任务创建者和所有订阅者发送桌面通知。

#### Scenario: 任务执行失败
- **WHEN** 任务状态变为 failed
- **THEN** 系统 SHALL 发送桌面通知，标题为"任务失败"，内容包含任务描述前 30 字符

### Requirement: Task reviewing notification
当任务进入待审核状态时，系统 SHALL 向任务创建者（Leader）发送桌面通知。

#### Scenario: 任务进入审核
- **WHEN** 所有成员执行完毕，任务状态变为 reviewing
- **THEN** 系统 SHALL 向 task.createBy 发送桌面通知，标题为"任务待审核"

### Requirement: Notification dedup for self-actions
系统 SHALL NOT 在用户自身触发状态变更时发送通知（避免自己操作后收到自己操作的通知）。

#### Scenario: Leader 分派任务给自己
- **WHEN** Leader 创建并分派任务，且 Leader 自己也是订阅者
- **THEN** 系统 SHALL NOT 向 Leader 发送 dispatched 通知

#### Scenario: Member 完成自己执行的任务
- **WHEN** Member 完成任务执行，状态变为 reviewing
- **THEN** 系统 SHALL NOT 向该 Member 发送 reviewing 通知
