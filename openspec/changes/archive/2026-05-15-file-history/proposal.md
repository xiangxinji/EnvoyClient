## Why

当前聊天消息仅存在内存中，页面刷新即丢失。用户需要消息持久化能力——既能回看历史记录，又能方便地导出/导入 JSON 文件进行备份或迁移。

## What Changes

- 新增 Rust 端历史记录文件管理模块：负责路径计算、JSON 读写、文件创建
- 新增 4 个 Tauri Command：save_message、load_history、export_history、import_history
- 前端 useTeamClient 集成：连接成功后加载历史、新消息到达时保存
- 存储路径固定在用户根目录 `~/.envoy/history/${当前用户名}/${对方用户名}.json`

## Capabilities

### New Capabilities
- `message-persistence`: 消息持久化存储，通过 Rust 文件 IO 将聊天记录保存为 JSON 文件，支持加载、导出和导入

### Modified Capabilities
<!-- 无已有 spec 需要修改 -->

## Impact

- **Rust 后端**：新增 `src/history.rs` 模块，`src/lib.rs` 增加 4 个 command
- **Rust 依赖**：需要 `dirs` crate 获取用户根目录
- **前端**：`useTeamClient.ts` 增加历史加载和保存逻辑
- **文件系统**：在用户根目录创建 `~/.envoy/history/` 目录结构
