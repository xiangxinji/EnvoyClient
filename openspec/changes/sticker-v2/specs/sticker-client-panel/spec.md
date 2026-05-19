## ADDED Requirements

### Requirement: StickerPanel loads stickers from Manager API
StickerPanel 组件 SHALL 通过 `GET /api/stickers?user={userId}` 从 Manager 后端加载贴纸列表，使用 `apiUrl()` 构建请求 URL，携带 `team` header。

#### Scenario: Load stickers on mount
- **WHEN** StickerPanel 挂载时
- **THEN** 调用 Manager API 获取贴纸列表并显示网格

#### Scenario: Manager offline or error
- **WHEN** API 请求失败
- **THEN** 显示错误信息，不崩溃

### Requirement: StickerPanel uploads stickers via Manager API
StickerPanel SHALL 通过 `POST /api/stickers` 上传贴纸。在 Tauri 环境中使用 `@tauri-apps/plugin-dialog` 的 `open()` 选择文件，然后通过 fetch multipart 上传。上传成功后刷新列表。

#### Scenario: Upload sticker via file dialog
- **WHEN** 用户点击添加按钮，选择图片文件
- **THEN** 文件通过 Manager API 上传，成功后贴纸出现在网格中

#### Scenario: Upload file too large
- **WHEN** 选择的文件超过 1MB
- **THEN** 显示 Manager 返回的错误信息

### Requirement: StickerPanel deletes stickers via Manager API
StickerPanel SHALL 通过 `DELETE /api/stickers/:id?from={userId}` 删除贴纸，删除前显示二次确认对话框。删除成功后刷新列表。

#### Scenario: Delete sticker with confirmation
- **WHEN** 用户 hover 贴纸点击删除按钮，确认删除
- **THEN** 调用 Manager API 删除，成功后贴纸从网格中移除

#### Scenario: Delete fails
- **WHEN** 删除 API 返回错误
- **THEN** 显示错误信息，贴纸保留在列表中

### Requirement: Send sticker uses server URL directly
点击贴纸发送时，SHALL 直接使用贴纸的服务端 URL 构建 `sticker` 字段（`{ url, name }`），通过 `sendChat()` 发送消息，无需二次上传文件。

#### Scenario: Send a sticker
- **WHEN** 用户点击网格中的贴纸
- **THEN** 使用贴纸的服务端 URL 发送消息，贴纸面板关闭

### Requirement: Remove Tauri sticker commands
客户端 SHALL 移除所有贴纸相关的 Tauri invoke 调用，StickerPanel 不再依赖 `stickers.rs` 中的任何命令。`src-tauri/src/stickers.rs` 文件 SHALL 被删除，`lib.rs` 中的 `mod stickers` 和命令注册 SHALL 被移除。

#### Scenario: No Tauri sticker imports
- **WHEN** StickerPanel 运行
- **THEN** 不调用任何 `invoke("list_stickers")`、`invoke("add_sticker")`、`invoke("delete_sticker")`

### Requirement: StickerPanel no longer uses Tauri invoke for file reading
StickerPanel 的 `handleStickerClick` SHALL 不再通过 `fetch(file:///...)` 读取本地文件并上传。发送贴纸直接使用已存储在 Manager 的 URL。

#### Scenario: No local file access on send
- **WHEN** 用户发送贴纸
- **THEN** 不发生本地文件读取或附件上传操作
