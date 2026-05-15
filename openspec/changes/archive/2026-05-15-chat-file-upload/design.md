## Context

当前聊天消息链路是纯文本：ChatPanel `<input>` → sendChat(text) → POST /api/messages {from,to,text} → WebSocket relay → handleIncomingMessage → MessageBubble marked(text)。从类型定义到传输到渲染全部是 `text: string`。底层存储（history.rs 的 serde_json::Value）和 Envoy 消息协议（payload: T）是 schema-free 的，扩展不需要改动。

## Goals / Non-Goals

**Goals:**
- 支持图片和文件附件上传，图片客户端压缩
- 微信风格图片卡片展示，文件附件下载链接
- Manager 作为文件中转服务器，附件按日期+UUID 持久化
- 向后兼容：旧消息无 attachments 字段时正常显示文本

**Non-Goals:**
- 不做视频/音频附件
- 不做附件编辑（裁剪、标注等）
- 不做 P2P 直传或外部存储（S3/OSS）
- 不修改 Envoy 框架的消息协议

## Decisions

### D1: 附件上传到 Manager 中转

文件通过 HTTP 上传到 Manager，Manager 存储到本地文件系统并返回下载 URL。聊天消息中携带附件 URL。

**替代方案**: WebSocket 传 Base64。rejected — 大文件会阻塞 WS 帧处理。

### D2: 图片客户端 Canvas 压缩

上传前在浏览器端用 Canvas API 压缩：最大宽度 1920px，JPEG 质量 0.8。压缩后仍超过 500KB 则逐步降低质量（0.6, 0.4）。非图片文件不压缩。

**替代方案**: 服务端压缩。rejected — 增加上传时间和 Manager 负担，本地应用无此必要。

### D3: 附件存储路径

```
~/.envoy/attachments/{team}/{YYYY-MM-DD}/{uuid}.{ext}
```

按 team 隔离，按日期归档，UUID 保证唯一性。ext 保留原始扩展名。

### D4: 发送流程 — 先上传后发送

用户点击发送 → 逐个上传附件 → 收集 URL → 构造带 attachments 的消息 → POST /api/messages。上传期间发送按钮禁用，显示上传进度。如果附件上传失败，提示用户，不发送消息。

### D5: MessageBubble 图片卡片渲染

图片附件使用 `<img>` 标签，max-width: 100%，border-radius，点击时全屏查看。文件附件显示文件名 + 大小 + 下载图标。多个附件按序排列。

### D6: 文件大小限制

单文件上限 50MB。Manager 端校验 Content-Length，超过拒绝。

## Risks / Trade-offs

- **[图片压缩质量不可控]** → Canvas toBlob 对某些格式（如 GIF 动图）只能导出静态首帧。缓解：GIF 文件按 file 类型处理，不压缩。
- **[附件累积占用磁盘]** → 按日期组织，后续可加清理策略。当前版本不做自动清理。
- **[并发上传]** → 多个附件串行上传，避免 Manager 端并发写入问题。简单可靠。
