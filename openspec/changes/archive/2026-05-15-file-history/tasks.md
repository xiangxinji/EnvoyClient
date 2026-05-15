## 1. Rust 依赖与模块

- [x] 1.1 在 `src-tauri/Cargo.toml` 中添加 `dirs` 依赖
- [x] 1.2 创建 `src-tauri/src/history.rs`，定义消息序列化结构体（ChatMessage、TaskMessage）和路径计算函数 `history_dir(my_id) -> PathBuf`、`history_file(my_id, peer_id) -> PathBuf`
- [x] 1.3 实现 `save_message(my_id, peer_id, message_json)` — 读取现有文件（如有）、追加消息、写回
- [x] 1.4 实现 `load_history(my_id, peer_id)` — 读取并返回 Vec<serde_json::Value>
- [x] 1.5 实现 `load_all_history(my_id)` — 遍历 `${myId}/` 目录下所有 JSON 文件，返回 HashMap<String, Vec<serde_json::Value>>
- [x] 1.6 实现 `export_history(my_id, peer_id, target_path)` — 复制文件到指定路径
- [x] 1.7 实现 `import_history(my_id, peer_id, source_path)` — 读取外部文件、与现有记录按 id 去重合并、写回

## 2. Tauri Commands 注册

- [x] 2.1 在 `src-tauri/src/lib.rs` 中注册所有 history 相关 command（save_message、load_history、load_all_history、export_history、import_history）
- [x] 2.2 在 `src-tauri/capabilities/default.json` 中添加必要的权限（如果需要）

## 3. 前端集成

- [x] 3.1 在 `useTeamClient.ts` 的 `connect()` 成功回调中调用 `invoke("load_all_history", { myId })` 加载所有历史记录到 messages Map
- [x] 3.2 在 `addToConversation()` 中每次添加消息后调用 `invoke("save_message", { myId, peerId, message })` 持久化
- [x] 3.3 暴露 `exportHistory(peerId, targetPath)` 和 `importHistory(peerId, sourcePath)` 方法
