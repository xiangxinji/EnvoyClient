## 1. 类型定义

- [x] 1.1 在 `src/types.ts` 中新增 `StickerInfo` 接口（`url: string`, `name: string`），`ChatMessage` 类型新增可选字段 `sticker?: StickerInfo`

## 2. Tauri 后端命令

- [x] 2.1 在 `src-tauri/src/lib.rs` 中实现 `list_stickers` 命令：读取 `~/.envoy/stickers/{userId}/` 目录，过滤图片文件，返回文件列表
- [x] 2.2 实现 `add_sticker` 命令：复制源文件到 stickers 目录，以时间戳命名，检查 1MB 大小限制
- [x] 2.3 实现 `delete_sticker` 命令：删除指定贴纸文件

## 3. Manager 后端

- [x] 3.1 在 `manager/server/db.ts` 的消息存储中支持 `extra.sticker` JSON 字段的存取
- [x] 3.2 在 `manager/server/routes/messages.ts` 中确保 sticker 字段在消息 relay 时透传

## 4. StickerPanel 组件

- [x] 4.1 创建 `src/components/StickerPanel/` 目录式组件，包含贴纸网格布局、空状态提示、[+ 添加] 按钮
- [x] 4.2 实现贴纸加载：调用 `list_stickers` 获取列表，展示缩略图网格（~5 列，64px）
- [x] 4.3 实现添加贴纸：点击 [+ 添加] 调用 Tauri 文件对话框，选择图片后调用 `add_sticker`
- [x] 4.4 实现删除贴纸：hover 显示删除按钮，点击弹窗确认后调用 `delete_sticker`
- [x] 4.5 实现点击发送：点击贴纸缩略图 → 上传图片到 Manager 附件接口 → 发送包含 `sticker` 字段的消息 → 关闭面板

## 5. ChatPanel 集成

- [x] 5.1 在 `ChatPanel` 工具栏 `toolbar-left` 中新增贴纸按钮（笑脸 SVG 图标）
- [x] 5.2 集成 StickerPanel 组件，定位在工具栏上方，支持开关切换和点击外部关闭

## 6. MessageBubble 贴纸渲染

- [x] 6.1 在 `MessageBubble` 中检测 `sticker` 字段，切换为贴纸渲染模式：无气泡背景/边框，图片最大宽度 150px，居中对齐

## 7. 消息接收处理

- [x] 7.1 在 `useMessages` 的 `handleIncomingMessage` 中解析 `sticker` 字段，构建 `StickerInfo` 对象设置到 ChatMessage

## 8. 样式与主题

- [x] 8.1 StickerPanel 样式：毛玻璃面板（Standard glass），遵循设计系统规范，支持 dark/light 双主题
- [x] 8.2 贴纸消息渲染样式：确保 dark/light 主题下显示正确
