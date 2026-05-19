## Why

当前贴纸功能（sticker-feature）错误地将贴纸存储在客户端本地（`~/.envoy/stickers/{userId}/`），通过 Tauri Rust 命令管理。这导致贴纸无法跨设备同步、无法集中管理，且发送时需要从本地读取文件再上传——流程冗余且架构不合理。贴纸作为用户个人资产，应由 Manager 后端统一提供存储和 API，与附件上传保持一致的服务端管理模式。

## What Changes

- 移除 Tauri 后端 `stickers.rs` 及相关命令注册（`list_stickers`、`add_sticker`、`delete_sticker`）
- Manager 后端新增贴纸 REST API：上传（`POST /api/stickers`）、列表（`GET /api/stickers`）、删除（`DELETE /api/stickers/:id`）、静态文件下载
- Manager 后端新增 `stickers` SQLite 表（存储贴纸元数据）
- 重写客户端 `StickerPanel`：从调用 Tauri `invoke()` 改为调用 Manager REST API
- 发送贴纸时直接引用服务端 URL，无需二次上传
- 清理 `src-tauri/src/lib.rs` 中的 stickers 模块注册

## Capabilities

### New Capabilities
- `sticker-manager-api`: Manager 后端贴纸存储 API——上传、列表、删除、静态文件服务
- `sticker-client-panel`: 客户端贴纸面板——基于 Manager API 的贴纸选择、管理、发送

### Modified Capabilities

## Impact

- **Manager 后端**: `routes/messages.ts`（或新路由文件）新增 3-4 个端点，`db.ts` 新增 stickers 表和 CRUD
- **Tauri 后端**: 移除 `stickers.rs` 文件及 `lib.rs` 中的模块注册
- **客户端**: `StickerPanel` 组件重写，移除所有 `invoke()` 调用，改用 `fetch` 调 Manager API
- **客户端**: `useMessages.ts` 中的 sticker 字段处理保持不变（已正确实现）
- **客户端**: `MessageBubble` 贴纸渲染保持不变（已正确实现）
- **i18n**: 现有贴纸翻译基本可复用，可能需要微调错误提示文案
