## MODIFIED Requirements

### Requirement: 任务执行模式设置

SettingsPanel SHALL 提供"任务执行模式"下拉选择框和"AI 自动回复"开关。任务执行模式选项为"手动"和"自动接管"，默认值为"自动接管"。AI 自动回复开关默认关闭。选择/切换后 SHALL 立即保存到 settings.yml 的对应字段。

#### Scenario: 切换为手动模式
- **WHEN** 用户将任务执行模式切换为"手动"
- **THEN** settings.yml 中 `users.{username}.task_execution_mode` 保存为 `"manual"`，后续到达的任务不自动启动 Agent

#### Scenario: 切换为自动接管模式
- **WHEN** 用户将任务执行模式切换为"自动接管"
- **THEN** settings.yml 中 `users.{username}.task_execution_mode` 保存为 `"auto"`，后续到达的任务自动启动 Agent

#### Scenario: 首次打开设置页面
- **WHEN** 用户首次打开设置页面，settings.yml 中无 `task_execution_mode` 字段
- **THEN** 下拉选择框显示"自动接管"（默认值）

#### Scenario: 开启 AI 自动回复
- **WHEN** 用户将 AI 自动回复开关切换为开启
- **THEN** settings.yml 中 `users.{username}.ai_auto_reply` 保存为 `true`

#### Scenario: 关闭 AI 自动回复
- **WHEN** 用户将 AI 自动回复开关切换为关闭
- **THEN** settings.yml 中 `users.{username}.ai_auto_reply` 保存为 `false`，清除所有进行中的防抖定时器
