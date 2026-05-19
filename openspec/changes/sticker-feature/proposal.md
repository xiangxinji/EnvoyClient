## Why

当前聊天只支持纯文本和图片附件，缺少非正式的情感表达方式。贴纸是即时通讯中高频使用的功能，能显著提升团队沟通的趣味性和效率。

## What Changes

- 在聊天输入框工具栏新增贴纸按钮，点击弹出贴纸选择面板
- 支持用户从本地上传图片作为贴纸（通过 Tauri 文件对话框）
- 贴纸以扁平列表形式展示，支持 hover 删除
- 点击贴纸直接发送，不需要进入编辑器
- 贴纸消息独立渲染：大图（~150px）、无气泡边框、居中显示
- 复用现有附件上传流程传输贴纸图片，ChatMessage 新增 `sticker` 字段标记

## Capabilities

### New Capabilities
- `sticker-messaging`: 自定义贴纸的本地存储管理、贴纸面板 UI 交互、贴纸消息的发送与渲染

### Modified Capabilities
- `chat-attachments`: 贴纸通过附件上传通道传输，消息存储需支持 `sticker` 字段
- `tauri-file-commands`: 新增贴纸目录管理命令（list/add/delete）

## Impact

- **Tauri 后端** (`src-tauri/src/lib.rs`): 新增 3 个 sticker 相关命令
- **前端类型** (`src/types.ts`): 新增 `StickerInfo` 类型，`ChatMessage` 增加 `sticker` 字段
- **新组件** (`src/components/StickerPanel/`): 贴纸选择面板
- **修改组件**: `ChatPanel`（工具栏按钮 + 面板集成）、`MessageBubble`（贴纸渲染模式）
- **Manager 后端**: `db.ts`（extra.sticker 存储）、`messages.ts`（透传 sticker 字段）
- **本地存储**: 新增 `~/.envoy/stickers/{userId}/` 目录
