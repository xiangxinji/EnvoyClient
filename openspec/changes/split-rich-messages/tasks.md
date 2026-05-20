## 1. 类型定义

- [x] 1.1 在 `src/types.ts` 中定义 `ContentSegment` 联合类型：`{ type: "text", content: string } | { type: "image", blob: Blob, name: string } | { type: "cloudRef", ref: CloudRef }`

## 2. RichEditor 改造

- [x] 2.1 在 `src/components/RichEditor/main.vue` 中实现 `extractSegments()` 方法：遍历 TipTap doc JSON 节点，按顺序收集 text/image/cloudRef 段落，跳过空文字段落
- [x] 2.2 修改 `handleSend()` 方法：调用 `extractSegments()` 替代 `extractText()`，emit 从 `("send", text, images)` 改为 `("send", segments)`
- [x] 2.3 更新 RichEditor 暴露的 API 类型定义和 `PendingImage` 相关清理逻辑

## 3. ChatPanel 发送逻辑改造

- [x] 3.1 在 `src/components/ChatPanel/main.vue` 中实现 `handleSegmentedSend(segments: ContentSegment[])` 方法
- [x] 3.2 实现 Quote 挂载逻辑：只在第一条消息的 options 中携带 quote
- [x] 3.3 实现 Mention 分配逻辑：从每个 text 段落的 content 中提取对应的 mention IDs，只挂在该段落的 options 中
- [x] 3.4 实现 PendingFiles 追加发送：编辑器段落发送完毕后，逐个上传并发送每个 pendingFile 为独立消息
- [x] 3.5 将 `handleRichSend` 替换为 `handleSegmentedSend`，更新 RichEditor 的事件绑定
- [x] 3.6 处理上传失败场景：某段上传失败时停止后续发送，保留已发送的消息

## 4. 验证与测试

- [x] 4.1 验证纯文字消息发送行为不变
- [x] 4.2 验证 "文字+图片+文字" 拆分为 3 条消息
- [x] 4.3 验证连续图片拆分为多条独立图片消息
- [x] 4.4 验证 Quote 只挂在第一条消息上
- [x] 4.5 验证 Mention 只挂在包含 @ 的文字段落上
- [x] 4.6 验证 PendingFiles 每个文件独立一条消息
- [x] 4.7 验证空段落跳过（连续图片之间无空消息）
- [x] 4.8 验证图片上传失败时不发送该图片消息，已发送的文字消息不受影响
