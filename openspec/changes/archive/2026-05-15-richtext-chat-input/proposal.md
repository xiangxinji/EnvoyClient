## Why

当前聊天输入框是单行 `<input>`，不支持多行文本、粘贴图片、拖拽文件。作为 Agent 协作工具，用户经常需要粘贴截图或拖拽文件发送，当前体验较差。需要改为微信风格的富文本输入区域，提升消息编辑体验。

## What Changes

- 将 ChatPanel 中的单行 `<input>` 替换为 TipTap 富文本编辑器（多行 contenteditable）
- 工具栏移到输入框下方（微信风格），包含：附件上传按钮、表情占位、发送按钮
- 支持粘贴图片直接内联到编辑器（Ctrl+V / Cmd+V）
- 支持拖拽文件到编辑器区域上传
- 编辑器自动增高（min 40px, max 120px），超出后滚动
- 发送时从编辑器提取纯文本 + 图片附件，走现有 `sendChat()` 通道
- 数据模型（ChatMessage、MessageAttachment）不变

## Capabilities

### New Capabilities
- `richtext-input`: TipTap 富文本输入组件，支持多行文本编辑、粘贴图片内联、拖拽文件上传、工具栏操作

### Modified Capabilities
<!-- 无，数据模型不变 -->

## Impact

- **新增依赖**: `@tiptap/vue-3`, `@tiptap/pm`, `@tiptap/extension-document`, `@tiptap/extension-paragraph`, `@tiptap/extension-text`, `@tiptap/extension-hard-break`, `@tiptap/extension-placeholder`, `@tiptap/extension-image`
- **修改文件**: `src/components/ChatPanel.vue`（重构 .input-area）
- **新增文件**: `src/components/RichEditor.vue`（TipTap 编辑器封装组件）
- **不变**: `types.ts`, `useMessages.ts`, `MessageBubble.vue`, `useAI.ts`
- **无 API 变更**: 消息发送仍走 `/api/messages`，附件上传仍走 `/api/messages/attachments`
