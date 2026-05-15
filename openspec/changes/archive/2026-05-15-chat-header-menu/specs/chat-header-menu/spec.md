## ADDED Requirements

### Requirement: 聊天头部下拉菜单

ChatPanel header 右侧 SHALL 显示一个 ⋮ 下拉按钮。点击 SHALL 展开操作菜单，菜单 SHALL 至少包含"清除聊天记录"选项。点击菜单外部 SHALL 关闭菜单。

#### Scenario: 打开菜单
- **WHEN** 用户点击 header 右侧的 ⋮ 按钮
- **THEN** 下拉菜单 SHALL 展开，显示操作选项列表

#### Scenario: 关闭菜单
- **WHEN** 菜单已展开，用户点击菜单外的任意区域
- **THEN** 菜单 SHALL 关闭

#### Scenario: 再次点击按钮关闭
- **WHEN** 菜单已展开，用户再次点击 ⋮ 按钮
- **THEN** 菜单 SHALL 关闭

### Requirement: 清除聊天记录

菜单中的"清除聊天记录"选项 SHALL 同时清除内存中的对话消息和 Tauri 持久化的历史文件。清除前 SHALL 弹出确认对话框。

#### Scenario: 确认清除
- **WHEN** 用户点击"清除聊天记录"并在确认对话框中点击确认
- **THEN** 系统 SHALL 清空与该 peer 的内存消息列表，删除对应的历史文件，消息区域变为空

#### Scenario: 取消清除
- **WHEN** 用户点击"清除聊天记录"但在确认对话框中点击取消
- **THEN** 系统 SHALL 不做任何操作，菜单关闭

#### Scenario: 清除后继续聊天
- **WHEN** 用户清除聊天记录后发送新消息
- **THEN** 系统 SHALL 正常发送消息，历史文件重新创建
