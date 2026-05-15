## ADDED Requirements

### Requirement: 消息附件类型定义

系统 SHALL 定义 `MessageAttachment` 接口，包含以下字段：
- `type`: "image" | "file"
- `url`: string（Manager 上的下载路径）
- `name`: string（原始文件名）
- `size`: number（字节数）
- `mimeType`: string（MIME 类型）

`ChatMessage` 接口 SHALL 新增可选字段 `attachments?: MessageAttachment[]`。

#### Scenario: 旧消息无 attachments 字段
- **WHEN** 收到一条没有 attachments 字段的历史消息
- **THEN** MessageBubble 正常渲染文本内容，不显示任何附件区域

#### Scenario: 新消息包含图片附件
- **WHEN** 收到一条 attachments 包含 `{ type: "image", url: "/api/messages/attachments/xxx.jpg", name: "photo.jpg", size: 245000, mimeType: "image/jpeg" }` 的消息
- **THEN** MessageBubble 渲染图片卡片

### Requirement: 附件上传端点

Manager SHALL 提供 `POST /api/messages/attachments` 端点，接受 multipart/form-data 上传（file + from 字段），需要 team header。文件 SHALL 存储到 `~/.envoy/attachments/{team}/{YYYY-MM-DD}/{uuid}.{ext}`。单文件大小上限 50MB，超过 SHALL 返回 413 错误。

#### Scenario: 上传图片成功
- **WHEN** POST /api/messages/attachments，team header 为 "alpha"，file 为 photo.jpg (200KB)
- **THEN** 文件存储到 `~/.envoy/attachments/alpha/2026-05-14/{uuid}.jpg`，返回 `{ url: "/api/messages/attachments/{date}/{uuid}.jpg", name: "photo.jpg", size: 200000, mimeType: "image/jpeg" }`

#### Scenario: 文件超过大小限制
- **WHEN** 上传文件大小超过 50MB
- **THEN** 返回 413 错误 `{ error: "File too large, max 50MB" }`

#### Scenario: 缺少 team header
- **WHEN** POST /api/messages/attachments 不带 team header
- **THEN** 返回 400 错误

### Requirement: 附件下载端点

Manager SHALL 提供 `GET /api/messages/attachments/:date/:file` 端点，需要 team header。返回文件内容，Content-Type 根据 MIME type 设置，Content-Disposition 为 attachment。

#### Scenario: 下载存在的附件
- **WHEN** GET /api/messages/attachments/2026-05-14/xxx.jpg，team header 为 "alpha"
- **THEN** 返回文件内容，Content-Type: image/jpeg

#### Scenario: 下载不存在的附件
- **WHEN** GET /api/messages/attachments/2026-05-14/nonexistent.jpg
- **THEN** 返回 404 错误

### Requirement: 消息转发扩展

Manager 的 `POST /api/messages` SHALL 支持请求体中的 `attachments` 字段。relay 时 SHALL 将 attachments 随 payload 一起转发到目标客户端。

#### Scenario: 发送带附件的消息
- **WHEN** POST /api/messages body 包含 `{ from: "bob", to: "alice", text: "看这个", attachments: [...] }`
- **THEN** Manager 将完整 payload（含 attachments）通过 WebSocket relay 到 alice

### Requirement: 前端图片压缩

上传图片前，客户端 SHALL 对图片进行压缩：最大宽度 1920px 等比缩放，JPEG 质量 0.8。压缩后仍超过 500KB SHALL 逐步降低质量到 0.6、0.4。GIF 和非图片文件 SHALL 不压缩，按 file 类型处理。

#### Scenario: 上传大图片
- **WHEN** 用户选择一张 4000x3000 的 5MB JPEG 图片
- **THEN** 压缩为 1920x1440，质量 0.8，通常压缩到 200-500KB 后上传

#### Scenario: 上传 GIF
- **WHEN** 用户选择一个 GIF 动图
- **THEN** 不压缩，按 file 类型直接上传

#### Scenario: 上传普通文件
- **WHEN** 用户选择一个 .zip 文件
- **THEN** 不压缩，直接上传

### Requirement: 附件选择与预览

ChatPanel 输入区 SHALL 显示附件按钮。点击后弹出文件选择器（accept 图片和所有文件类型）。选择后 SHALL 在输入框上方显示预览区域：图片显示缩略图，文件显示文件名+大小。预览区每个附件有删除按钮。

#### Scenario: 选择图片附件
- **WHEN** 用户点击附件按钮并选择一张图片
- **THEN** 输入框上方显示图片缩略图预览，带删除按钮

#### Scenario: 选择文件附件
- **WHEN** 用户点击附件按钮并选择一个 .log 文件
- **THEN** 输入框上方显示文件名和大小，带删除按钮

#### Scenario: 删除附件
- **WHEN** 用户点击预览区附件的删除按钮
- **THEN** 该附件从预览区移除

### Requirement: 带附件发送消息

发送带附件的消息时 SHALL 先上传所有附件（串行），收集 URL 后构造 ChatMessage（含 attachments）再发送。上传期间发送按钮 SHALL 禁用并显示上传状态。

#### Scenario: 发送纯文本消息
- **WHEN** 用户输入文本，无附件，点击发送
- **THEN** 直接发送，行为与现有一致

#### Scenario: 发送带附件的消息
- **WHEN** 用户输入文本并有一个图片附件，点击发送
- **THEN** 先上传图片，获取 URL，构造 { text, attachments: [...] } 消息发送

#### Scenario: 附件上传失败
- **WHEN** 附件上传过程中网络错误
- **THEN** 不发送消息，显示错误提示，保留输入文本和附件预览

### Requirement: 图片卡片展示

MessageBubble 对图片附件 SHALL 渲染为卡片式展示：图片占满气泡最大宽度，圆角，加载中显示占位符。点击图片 SHALL 全屏查看（遮罩层 + 原图尺寸）。

#### Scenario: 渲染图片附件
- **WHEN** 消息包含一个图片附件
- **THEN** 在文本下方显示图片卡片，max-width: 100%，border-radius: 8px

#### Scenario: 点击图片查看大图
- **WHEN** 用户点击图片卡片
- **THEN** 显示全屏遮罩层，居中显示原图，点击遮罩关闭

### Requirement: 文件附件展示

MessageBubble 对文件附件 SHALL 显示文件名 + 文件大小 + 下载图标。点击 SHALL 下载文件。

#### Scenario: 渲染文件附件
- **WHEN** 消息包含一个 file 类型附件 { name: "report.pdf", size: 1024000 }
- **THEN** 显示 "report.pdf · 1000 KB" 和下载图标

### Requirement: 接收带附件的消息

useMessages 的 handleIncomingMessage SHALL 从消息 payload 中解析 attachments 字段，构造包含 attachments 的 ChatMessage。

#### Scenario: 收到带图片的消息
- **WHEN** WebSocket 收到 message，payload 包含 { text: "看这个", attachments: [{ type: "image", ... }] }
- **THEN** 构造的 ChatMessage 包含 attachments 数组，MessageBubble 正确渲染
