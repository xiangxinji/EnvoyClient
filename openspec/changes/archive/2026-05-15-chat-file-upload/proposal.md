## Why

当前聊天消息只支持纯文本，成员之间无法分享截图、文档、日志文件等。在实际协作中，成员经常需要通过图片说明问题或通过文件传递数据，缺少附件能力严重限制了沟通效率。

## What Changes

- ChatMessage 类型新增 `attachments?: MessageAttachment[]` 字段（向后兼容，旧消息无此字段正常渲染）
- MessageAttachment 接口：type("image"|"file")、url、name、size、mimeType
- ChatPanel 新增附件按钮、预览区域（图片缩略图/文件名+大小）、先上传附件再发送消息的完整流程
- 图片上传前客户端 Canvas 压缩：最大宽度 1920px + 质量 0.8，超过 500KB 再降质量
- MessageBubble 新增图片卡片展示（微信风格，占满气泡宽度，点击查看大图）和文件附件下载链接
- Manager 新增 `POST /api/messages/attachments` 上传端点和 `GET /api/messages/attachments/:file` 下载端点
- 附件存储路径：`~/.envoy/attachments/{team}/{YYYY-MM-DD}/{uuid}.{ext}`
- useMessages 的 sendChat 和 handleIncomingMessage 扩展支持 attachments
- Manager `/api/messages` 转发逻辑扩展：payload 中携带 attachments 字段

## Capabilities

### New Capabilities
- `chat-attachments`: 聊天消息附件 — 图片/文件上传、压缩、存储、传输、展示的完整能力

### Modified Capabilities

## Impact

- **前端类型**: types.ts 新增 MessageAttachment 接口，ChatMessage 增加 attachments 字段
- **前端组件**: ChatPanel.vue 改动较大（附件按钮+预览+上传逻辑），MessageBubble.vue 新增附件渲染
- **前端逻辑**: useMessages.ts 的 sendChat 和 handleIncomingMessage 扩展
- **Manager 后端**: messages.ts 新增两个端点 + 扩展消息转发 payload
- **存储**: ~/.envoy/attachments/ 新目录，按 team/日期/uuid 组织
- **无影响**: Tauri history.rs（serde_json::Value 兼容）、Envoy 消息协议（payload: T 兼容）
