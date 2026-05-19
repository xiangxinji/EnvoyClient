## Context

当前聊天系统支持文本消息和图片/文件附件，消息通过 Manager 中转（REST API + WebSocket relay）。编辑器基于 Tiptap，工具栏已有任务分派、附件、AI 建议三个按钮。本地文件操作通过 Tauri commands 完成，数据存储在 `~/.envoy/` 目录下。消息类型使用 `ChatMessage`，附件通过 `MessageAttachment[]` 传输，额外字段（quote、forwarded）存储在 Manager SQLite 的 `extra` JSON 列中。

## Goals / Non-Goals

**Goals:**
- 用户可以从本地添加自定义贴纸图片
- 点击贴纸直接发送，无需进入编辑器
- 贴纸消息独立渲染（大图、无气泡）
- 支持贴纸的添加和删除管理

**Non-Goals:**
- 不做贴纸包分组/分类
- 不做贴纸商店或云端同步
- 不支持贴纸 + 文字组合发送
- 不做 GIF 搜索

## Decisions

### 1. 贴纸存储：本地扁平目录

**决定**: `~/.envoy/stickers/{userId}/` 扁平目录，所有贴纸图片直接存放。

**理由**: 最简实现，无需数据库或索引文件。文件名即贴纸标识。通过 Tauri 文件选择对话框添加时，复制源文件到此目录并生成唯一文件名（时间戳 + 原始扩展名）以避免冲突。

**替代方案**: SQLite 存储 → 过重，图片文件仍需文件系统。JSON 索引 → 额外维护成本，文件名已足够。

### 2. 消息传输：复用附件上传 + sticker 字段标记

**决定**: 发送贴纸时，先将图片上传到 Manager 附件存储（复用 `POST /api/messages/attachments`），然后在 `ChatMessage` 的 `sticker` 字段中携带 `{ url, name }`。不放入 `attachments` 数组。

**理由**: 复用现有上传通道，无需新建上传 API。独立的 `sticker` 字段让接收端可以区分贴纸和普通图片附件，采用不同渲染逻辑。与 `quote`、`forwarded` 字段模式一致，统一存储在 Manager SQLite 的 `extra` JSON 列中。

**替代方案**: 直接在消息体传 base64 → 体积大、不可缓存。仅传本地文件名 → 对方无此文件。

### 3. 贴纸面板：工具栏上方弹出

**决定**: 贴纸面板作为 `StickerPanel` 组件，定位在工具栏正上方，通过 CSS absolute/relative 定位弹出。

**理由**: 与主流 IM（微信、Telegram）一致的面板位置。面板内贴纸以网格（~5 列）展示，每格 ~64px 缩略图。hover 时右上角显示删除按钮（✕）。底部有 [+ 添加] 按钮调用 Tauri 文件对话框选择图片文件（支持 png/jpg/gif/webp）。

### 4. 贴纸渲染：独立消息样式

**决定**: 贴纸消息在 `MessageBubble` 中检测 `sticker` 字段，切换为贴纸渲染模式：不显示气泡背景/边框，直接展示图片，尺寸限制 ~150px 宽度，居中对齐。

**理由**: 贴纸的视觉语义不同于普通消息，不应被气泡包裹。参考微信的贴纸渲染方式。

### 5. Tauri 命令设计

**决定**: 新增三个 Tauri invoke 命令：
- `list_stickers(userId)` → 返回贴纸文件列表 `[{ name, path }]`
- `add_sticker(userId, srcPath)` → 复制文件到 stickers 目录，返回新文件信息
- `delete_sticker(userId, name)` → 从目录删除指定文件

**理由**: 遵循项目现有 Tauri 命令模式（file_read/file_write 等），目录隔离在 `~/.envoy/` 下，复用已有的路径安全检查逻辑。

## Risks / Trade-offs

- **[大文件贴纸]** → 上传前进行尺寸检查，限制单张贴纸 1MB 以内，超限时提示压缩或拒绝
- **[大量贴纸性能]** → 列表贴纸使用缩略图或懒加载，目录文件数超过 200 时给予提示
- **[GIF 动画]** → 支持 GIF 格式但接收端渲染为 `<img>` 标签，浏览器原生支持动画，无需特殊处理
- **[删除不可恢复]** → 删除操作前弹窗二次确认，符合项目的危险操作规范
