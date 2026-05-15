## ADDED Requirements

### Requirement: 侧边栏设置入口

MemberSidebar 底部 SHALL 固定显示一个设置按钮（齿轮图标），不随成员列表滚动。点击后 SHALL 将 `selectedPeer` 设为 `__settings__`，右侧内容区切换为 SettingsPanel。

#### Scenario: 点击设置按钮
- **WHEN** 用户点击侧边栏底部的设置按钮
- **THEN** selectedPeer 变为 `__settings__`，右侧显示 SettingsPanel 组件

#### Scenario: 设置按钮始终可见
- **WHEN** 成员列表很长需要滚动
- **THEN** 设置按钮固定在侧边栏底部，不随列表滚动

### Requirement: 任务执行模式设置

SettingsPanel SHALL 提供"任务执行模式"下拉选择框，选项为"手动"和"自动接管"。默认值为"自动接管"。选择后 SHALL 立即保存到 settings.yml 的 `users.{username}.task_execution_mode` 字段（值为 `manual` 或 `auto`）。

#### Scenario: 切换为手动模式
- **WHEN** 用户将任务执行模式切换为"手动"
- **THEN** settings.yml 中 `users.{username}.task_execution_mode` 保存为 `"manual"`，后续到达的任务不自动启动 Agent

#### Scenario: 切换为自动接管模式
- **WHEN** 用户将任务执行模式切换为"自动接管"
- **THEN** settings.yml 中 `users.{username}.task_execution_mode` 保存为 `"auto"`，后续到达的任务自动启动 Agent

#### Scenario: 首次打开设置页面
- **WHEN** 用户首次打开设置页面，settings.yml 中无 `task_execution_mode` 字段
- **THEN** 下拉选择框显示"自动接管"（默认值）

### Requirement: 工作目录设置

SettingsPanel SHALL 提供工作目录输入框。留空时使用默认值 `~/.envoy/workspace/{username}`。输入值 SHALL 保存到 settings.yml 的 `users.{username}.working_directory` 字段。

#### Scenario: 设置自定义工作目录
- **WHEN** 用户在输入框中填写 `/home/bob/projects` 并保存
- **THEN** settings.yml 中 `users.{username}.working_directory` 保存为 `/home/bob/projects`，后续 Agent shell 命令在此目录下执行

#### Scenario: 清空工作目录
- **WHEN** 用户清空工作目录输入框并保存
- **THEN** settings.yml 中 `users.{username}.working_directory` 保存为空字符串，Agent 使用默认 `~/.envoy/workspace/{username}`

### Requirement: 设置页面返回

SettingsPanel 顶部 SHALL 显示"← 返回"按钮，点击后 SHALL 将 `selectedPeer` 恢复为上一次选择的值或 `__tasks__`。

#### Scenario: 点击返回按钮
- **WHEN** 用户在设置页面点击"← 返回"
- **THEN** 右侧内容区切换回任务中心视图
