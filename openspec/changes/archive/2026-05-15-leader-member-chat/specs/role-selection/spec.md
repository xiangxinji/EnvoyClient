## ADDED Requirements

### Requirement: Role selection form
系统 SHALL 在应用启动时显示角色选择页面，包含 Leader 和 Member 两个选项，以及 Client ID 输入框和 Server URL 输入框。

#### Scenario: User selects Leader role
- **WHEN** 用户选择 Leader 并填写 ID 和服务器地址后点击 Connect
- **THEN** 系统创建 Leader 实例并连接到指定服务器，成功后导航到聊天页面

#### Scenario: User selects Member role
- **WHEN** 用户选择 Member 并填写 ID 和服务器地址后点击 Connect
- **THEN** 系统创建 Member 实例并连接到指定服务器，成功后导航到聊天页面

### Requirement: Connection validation
系统 SHALL 验证 Client ID 非空且 Server URL 格式合法（ws:// 或 wss:// 开头），验证失败时在对应输入框下方显示错误提示。

#### Scenario: Empty client ID
- **WHEN** 用户未填写 Client ID 就点击 Connect
- **THEN** 系统在 ID 输入框下方显示错误提示，不发起连接

#### Scenario: Invalid server URL
- **WHEN** 用户填写的 Server URL 不以 ws:// 或 wss:// 开头
- **THEN** 系统在 Server URL 输入框下方显示错误提示，不发起连接

### Requirement: Connection status feedback
系统 SHALL 在连接过程中显示 loading 状态，连接失败时显示错误信息并允许重试。

#### Scenario: Connection in progress
- **WHEN** 用户点击 Connect 后正在建立连接
- **THEN** Connect 按钮显示 loading 状态且不可重复点击

#### Scenario: Connection failed
- **WHEN** 连接失败（服务器不可达或拒绝）
- **THEN** 系统显示错误信息，Connect 按钮恢复可点击状态
