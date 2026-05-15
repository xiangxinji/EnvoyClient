## Why

ChatPanel 的头部目前只显示对话者名字和在线状态，没有任何操作入口。用户无法清除与某人的聊天记录，导致消息列表越来越长，无法整理。

## What Changes

- ChatPanel header 右侧新增下拉菜单按钮（⋮ 图标），点击展开操作菜单
- 菜单提供"清除聊天记录"选项，点击后清除与当前 peer 的内存消息 + Tauri 持久化历史文件
- `useTeamClient` 新增 `clearConversation(peerId)` 方法
- Tauri 后端新增 `delete_history` command 删除 `~/.envoy/history/{userId}/{peerId}.json`

## Capabilities

### New Capabilities
- `chat-header-menu`: 聊天面板头部操作菜单——下拉按钮、清除聊天记录功能

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **ChatPanel.vue**: header 区域增加 dropdown 组件
- **useTeamClient.ts**: 新增 `clearConversation` 方法
- **src-tauri/src/lib.rs**: 新增 `delete_history` Tauri command
- **src-tauri/src/history.rs**: 新增 `delete_history` 函数
