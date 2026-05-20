## Context

当前 RichEditor (TipTap) 中用户可以混合输入文字、粘贴图片、插入云资源引用。发送时 `extractText()` 将所有 `<img>` 标签剥离（丢失位置信息），图片单独收集为 `pendingImages[]`，最终合并为一条 `ChatMessage` 发送。这导致：

1. 消息结构复杂（一条消息可能同时包含 text + N 个 attachments + cloudRefs + quote）
2. 样式定义困难（渲染时需要判断多种组合）
3. 文件上传流程管控复杂（所有附件在同一事务中）

目标：将混合内容拆分为多条原子消息，每条消息只包含一种主要内容类型。

## Goals / Non-Goals

**Goals:**
- RichEditor 输出有序段落列表，保留文字和图片的原始位置顺序
- ChatPanel 顺序逐条发送，每条消息是原子单元（纯文字 / 单张图片 / 单个文件 / 单个云资源引用）
- Quote 只附加在第一条消息上
- Mention 只附加在包含对应 @ 的文字段落上
- 保持现有渲染侧（BubbleContent / MessageBubble）不变

**Non-Goals:**
- 不改变消息的数据结构（`ChatMessage` 接口不变）
- 不改变 `useMessages.sendChat` 和 `MessageService` 的签名
- 不改变接收端的处理逻辑
- 不实现"合并显示"（连续的同类型消息仍然独立显示，不合并气泡）

## Decisions

### Decision 1: 在 RichEditor 层做内容拆分

**选择**: 在 RichEditor 中新增 `extractSegments()` 方法，替代原有 `extractText()`。

**替代方案**:
- 在 ChatPanel 层做拆分：但 ChatPanel 拿到的 text 已经丢失了图片位置信息，无法还原顺序
- 在 useMessages 层做拆分：职责过重，useMessages 不应了解编辑器内容结构

**理由**: RichEditor 拥有 TipTap 文档的完整结构，是唯一能准确获取节点顺序的地方。

### Decision 2: 串行顺序发送

**选择**: 使用 `for...of` + `await` 逐条发送段落消息。

**替代方案**:
- `Promise.all` 并行发送：无法保证消息到达顺序，可能导致显示错乱
- 单次 API 调用批量发送：需要后端新增批量接口，改动面过大

**理由**: `sendChat` 内部使用乐观更新（先本地添加再 API 调用），串行发送下用户会看到消息逐条冒出，体验接近微信。代价是 N 条消息需要 N 次 API 调用，但聊天场景下 N 通常很小（1-5）。

### Decision 3: Emit 签名变更

**选择**: RichEditor 的 emit 从 `("send", text, images)` 改为 `("send", segments)`。

**理由**: 旧签名无法传递顺序信息。新签名 `ContentSegment[]` 包含完整的有序内容。`ContentSegment` 类型定义：
```ts
type ContentSegment =
  | { type: "text"; content: string }
  | { type: "image"; blob: Blob; name: string }
  | { type: "cloudRef"; ref: CloudRef }
```

### Decision 4: pendingFiles 追加在末尾

**选择**: 编辑器内的 segments 先发送完毕，再逐个发送 pendingFiles（通过回形针按钮选择的文件）。

**理由**: pendingFiles 不在编辑器内，用户对它们的位置没有预期。追加在末尾是最自然的顺序。

### Decision 5: 空段落跳过

**选择**: 连续图片之间的空文字段落（trim 后为空）跳过，不发送空消息。

**理由**: 用户粘贴两张连续图片时不应该产生夹在中间的空消息。

## Risks / Trade-offs

- **[多条 API 调用]** → 聊天场景下通常 1-5 条消息，延迟可接受。如果未来需要优化，可在后端增加批量发送接口。
- **[网络中断时部分发送]** → 用户可能看到前几条消息已发出、后几条失败。这是可接受的体验，与微信行为一致（微信也可能部分发送失败）。
- **[Quote 只挂第一条]** → 如果第一条是图片消息，quote 会挂在图片消息上。这在语义上略不自然但可接受。
- **[RichEditor emit 签名变更]** → 需要同时更新所有调用方（目前只有 ChatPanel）。影响面可控。
