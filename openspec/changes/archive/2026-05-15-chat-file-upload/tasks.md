## 1. 类型定义

- [x] 1.1 在 src/types.ts 新增 MessageAttachment 接口（type, url, name, size, mimeType）
- [x] 1.2 ChatMessage 接口新增 `attachments?: MessageAttachment[]` 可选字段

## 2. Manager 附件 API

- [x] 2.1 在 manager/server/routes/messages.ts 新增 `POST /api/messages/attachments` 上传端点：multipart/form-data，存储到 ~/.envoy/attachments/{team}/{YYYY-MM-DD}/{uuid}.{ext}，50MB 限制
- [x] 2.2 新增 `GET /api/messages/attachments/:date/:file` 下载端点：按路径读取文件返回
- [x] 2.3 扩展 `POST /api/messages`：relay 时将 payload 中的 attachments 字段一起转发

## 3. 消息收发逻辑

- [x] 3.1 修改 useMessages.ts 的 sendChat：支持 attachments 参数，POST /api/messages 时携带 attachments
- [x] 3.2 修改 useMessages.ts 的 handleIncomingMessage：从 payload 中解析 attachments 字段构造 ChatMessage

## 4. 图片压缩工具

- [x] 4.1 创建 src/utils/imageCompress.ts：Canvas API 压缩图片，最大宽度 1920px，质量 0.8，超 500KB 降质量，GIF 不压缩

## 5. ChatPanel 附件交互

- [x] 5.1 ChatPanel 输入区新增附件按钮 [📎]，点击弹出文件选择器
- [x] 5.2 新增附件预览区域：图片缩略图/文件名+大小，每个附件带删除按钮
- [x] 5.3 实现发送逻辑：有附件时先串行上传，收集 URL 后构造消息发送，上传中禁用发送按钮
- [x] 5.4 附件上传失败时显示错误提示，保留输入文本和预览

## 6. MessageBubble 附件渲染

- [x] 6.1 图片附件卡片渲染：<img> max-width:100% 圆角，加载中占位符
- [x] 6.2 图片点击全屏查看：遮罩层 + 原图居中，点击关闭
- [x] 6.3 文件附件渲染：文件名 + 大小 + 下载图标/链接
- [x] 6.4 附件区域样式：dark/light 双色 CSS 变量
