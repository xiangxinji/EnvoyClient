## 1. Manager 后端——数据库层

- [x] 1.1 在 `db.ts` 中添加 `stickers` 表的 CREATE TABLE 语句和索引，在 `initTeamDatabase` 中执行创建
- [x] 1.2 在 `db.ts` 中添加 StickerRecord 类型定义和 CRUD 函数：insertSticker、listStickers、getStickerById、deleteSticker

## 2. Manager 后端——API 路由

- [x] 2.1 在 `routes/messages.ts` 中添加 `POST /api/stickers` 端点：接收 multipart/form-data（file + from），校验大小和类型，存储文件并插入数据库
- [x] 2.2 在 `routes/messages.ts` 中添加 `GET /api/stickers` 端点：查询指定用户的贴纸列表
- [x] 2.3 在 `routes/messages.ts` 中添加 `DELETE /api/stickers/:id` 端点：校验权限后删除数据库记录和文件
- [x] 2.4 在 `routes/messages.ts` 中添加 `GET /api/stickers/:team/:userId/:file` 端点：贴纸静态文件下载

## 3. 客户端——移除 Tauri 贴纸模块

- [x] 3.1 删除 `src-tauri/src/stickers.rs` 文件
- [x] 3.2 从 `src-tauri/src/lib.rs` 中移除 `mod stickers;` 和三个 sticker 命令注册

## 4. 客户端——重写 StickerPanel

- [x] 4.1 重写 `StickerPanel/main.vue`：loadStickers 改为调用 `GET /api/stickers` Manager API
- [x] 4.2 重写 handleAdd：使用 Tauri 文件对话框选择文件后，通过 `POST /api/stickers` 上传到 Manager
- [x] 4.3 重写 handleDeleteClick/handleDeleteConfirm：调用 `DELETE /api/stickers/:id` Manager API
- [x] 4.4 重写 handleStickerClick：直接使用贴纸的服务端 URL 发送消息，移除本地文件读取和二次上传逻辑
- [x] 4.5 移除所有 `invoke("list_stickers"/"add_sticker"/"delete_sticker")` 调用和 `convertToFileUrl` 辅助函数
- [x] 4.6 移除 `isTauri` 环境检测分支，统一使用 Manager API（文件选择对话框仍需 isTauri 判断）

## 5. 验证

- [x] 5.1 运行 `cargo check` 确认 Rust 编译通过
- [x] 5.2 运行 `vue-tsc --noEmit` 确认 TypeScript 类型检查通过
