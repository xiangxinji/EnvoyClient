## ADDED Requirements

### Requirement: 富编辑器段落提取

RichEditor SHALL 提供 `extractSegments()` 方法，遍历 TipTap 文档节点，返回有序的 `ContentSegment[]` 数组。`ContentSegment` SHALL 为以下三种类型之一：
- `{ type: "text", content: string }` — 文字段落（多个连续文字/段落节点合并）
- `{ type: "image", blob: Blob, name: string }` — 内联图片
- `{ type: "cloudRef", ref: CloudRef }` — 云资源引用

段落的顺序 SHALL 与编辑器中从上到下、从左到右的视觉顺序一致。

#### Scenario: 纯文字内容
- **WHEN** 编辑器内容为 "你好世界"
- **THEN** `extractSegments()` 返回 `[{ type: "text", content: "你好世界" }]`

#### Scenario: 文字夹图片
- **WHEN** 编辑器内容为 "aaa" + 图片 + "bbb"
- **THEN** `extractSegments()` 返回 `[{ type: "text", content: "aaa" }, { type: "image", ... }, { type: "text", content: "bbb" }]`

#### Scenario: 连续图片
- **WHEN** 编辑器内容为 图片A + 图片B
- **THEN** `extractSegments()` 返回 `[{ type: "image", ...A }, { type: "image", ...B }]`

#### Scenario: 文字中包含云资源引用
- **WHEN** 编辑器内容为 "请看" + CloudRef节点 + "文件"
- **THEN** `extractSegments()` 返回 `[{ type: "text", content: "请看" }, { type: "cloudRef", ref: ... }, { type: "text", content: "文件" }]`

#### Scenario: 空段落跳过
- **WHEN** 编辑器内容为 图片A + 空段落 + 图片B
- **THEN** `extractSegments()` 返回 `[{ type: "image", ...A }, { type: "image", ...B }]`，空段落被跳过

### Requirement: 富编辑器 Emit 签名变更

RichEditor 的 `send` 事件 SHALL 从 `emit("send", text: string, images: PendingImage[])` 变更为 `emit("send", segments: ContentSegment[])`。

#### Scenario: 发送纯文字
- **WHEN** 用户在编辑器输入 "hello" 并按 Enter
- **THEN** emit `("send", [{ type: "text", content: "hello" }])`

#### Scenario: 发送混合内容
- **WHEN** 编辑器包含 "aaa" + 图片 + "bbb" 并发送
- **THEN** emit `("send", [{ type: "text", content: "aaa" }, { type: "image", ... }, { type: "text", content: "bbb" }])`

### Requirement: 段落逐条发送

ChatPanel SHALL 顺序遍历 `ContentSegment[]`，对每个段落调用一次 `sendChat`，生成独立的原子消息。

- **text 段落**: `sendChat(peerId, content, options)` — options 中可含 quote（仅第一条）、mentions
- **image 段落**: 先调用 `uploadAttachment()` 上传，再 `sendChat(peerId, "", { attachments: [uploaded] })`
- **cloudRef 段落**: `sendChat(peerId, "", { cloudRefs: [ref] })`

#### Scenario: 单条文字消息
- **WHEN** segments 为 `[{ type: "text", content: "hello" }]`
- **THEN** 调用一次 `sendChat(peerId, "hello", {})`

#### Scenario: 文字加图片
- **WHEN** segments 为 `[{ type: "text", content: "看" }, { type: "image", blob, name: "a.jpg" }]`
- **THEN** 先调用 `sendChat(peerId, "看", {})`，再上传图片后调用 `sendChat(peerId, "", { attachments: [img] })`

#### Scenario: 图片消息带空 text
- **WHEN** segments 为 `[{ type: "image", blob, name: "photo.png" }]`
- **THEN** 上传图片后调用 `sendChat(peerId, "", { attachments: [img] })`，text 字段为空字符串

### Requirement: Quote 挂载在第一条消息

当用户在引用回复模式下发送混合内容时，QuoteInfo SHALL 只附加在第一条生成的消息上，后续消息不带 quote。

#### Scenario: 引用 + 文字 + 图片
- **WHEN** 用户引用了一条消息，然后输入 "aaa" + 图片并发送
- **THEN** "aaa" 消息携带 quote，图片消息不携带 quote

#### Scenario: 引用 + 图片（无文字）
- **WHEN** 用户引用了一条消息，然后只粘贴一张图片发送
- **THEN** 图片消息携带 quote

### Requirement: Mention 挂载在对应文字段落

@提及 SHALL 只附加在包含该 @ 用户 ID 的文字段落消息上。不包含 @ 的文字段落或图片消息 SHALL 不携带 mentions。

#### Scenario: 提及在某段文字中
- **WHEN** segments 为 `[{ type: "text", content: "@alice 你好" }, { type: "image", ... }, { type: "text", content: "看看" }]`
- **THEN** 第一条文字消息的 mentions 包含 alice，图片消息和第二条文字消息的 mentions 为空或不携带

### Requirement: PendingFiles 逐条追加发送

通过回形针按钮选择的 pendingFiles SHALL 在编辑器段落发送完毕后，逐个上传并发送为独立消息，每个文件一条。

#### Scenario: 两个文件附加发送
- **WHEN** 编辑器内容为 "文件来了" 且 pendingFiles 有 [report.pdf, data.xlsx]
- **THEN** 发送顺序：文字 "文件来了" → report.pdf 消息 → data.xlsx 消息

#### Scenario: 仅文件无文字
- **WHEN** 编辑器为空，pendingFiles 有 [report.pdf]
- **THEN** 发送一条文件消息，text 为空字符串
