## Why

当前富文本消息将文字、图片、文件、云资源引用混合在一条消息中发送。这导致消息结构复杂、样式难以定义、文件上传流程难以管控。微信等聊天工具的实践证明，原子化消息（每条消息只包含一种内容类型）更易管理、渲染和交互。

## What Changes

- **RichEditor 输出格式变更**：`extractText()` 返回的扁平字符串 + 独立图片数组，改为 `extractSegments()` 返回有序段落列表，保留内容在编辑器中的原始顺序
- **ChatPanel 发送逻辑变更**：`handleRichSend` 拆分为逐条发送，每个段落（文字/图片/云资源）独立成为一条消息
- **文件消息原子化**：pendingFiles 中的每个文件独立发送为一条消息
- **附件消息不再包含文字**：图片/文件消息的 text 字段为空字符串
- **Quote 挂载策略**：引用只附加在第一条消息上
- **Mention 挂载策略**：@提及只附加在包含对应 @ 的文字段落上

## Capabilities

### New Capabilities
- `message-segment-split`: 将富编辑器混合内容拆分为有序段落，并逐条发送为独立原子消息

### Modified Capabilities
- `chat-attachments`: 附件不再与文字合并在同一条消息中，每张图片/每个文件成为独立消息
- `team-chat`: 发送管道从单条合并消息变为多条顺序消息，RichEditor emit 签名变更

## Impact

- **RichEditor** (`src/components/RichEditor/main.vue`): `extractText()` → `extractSegments()`，emit 签名变更
- **ChatPanel** (`src/components/ChatPanel/main.vue`): `handleRichSend()` → `handleSegmentedSend()`，顺序发送多条消息
- **useMessages / MessageService**: 无变更，仍处理单条消息
- **BubbleContent / MessageBubble**: 渲染侧无需改动，每条消息的类型更单一（要么文字要么附件）
