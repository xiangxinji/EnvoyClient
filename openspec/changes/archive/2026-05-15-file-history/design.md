## Context

leader-member-chat 已实现完整的聊天 UI，消息存在 Vue 的 ref Map 中（`Map<string, TimelineItem[]>`），页面刷新即丢失。用户希望将消息以文件形式持久化到本地，便于回看、导出和导入。

现有技术栈：
- Rust 后端有 `serde` + `serde_json`
- 前端通过 `@tauri-apps/api/core` 的 `invoke()` 调用 Rust command
- 消息类型定义在 `src/types.ts`（ChatMessage、TaskMessage、TimelineItem）

## Goals / Non-Goals

**Goals:**
- 连接成功后自动加载与各成员的历史记录
- 每条新消息（发送和接收）自动保存到本地文件
- 支持导出某个对话的 JSON 文件到任意路径
- 支持从 JSON 文件导入历史记录
- 存储路径为 `~/.envoy/history/${myId}/${peerId}.json`

**Non-Goals:**
- 消息搜索功能
- 加密存储
- 历史记录的容量限制/清理策略
- 跨设备同步
- 导出为非 JSON 格式（如 PDF、HTML）

## Decisions

### D1: Rust Command 而非 FS Plugin

**选择**：使用自定义 Tauri Command + `std::fs` 进行文件操作。

**替代方案**：`@tauri-apps/plugin-fs` 从前端直接操作文件。

**理由**：用户明确要求文件存储，Rust 端可以完全控制路径、序列化格式、错误处理。后续如需加密或切换存储后端只改 Rust 端。`std::fs` 和 `serde_json` 已是依赖，无需额外引入 FS plugin。

### D2: 用户根目录而非 AppData

**选择**：固定路径 `~/.envoy/history/${myId}/${peerId}.json`。

**替代方案**：Tauri 的 AppData 目录。

**理由**：用户指定。方便直接访问，多客户端可共享同一目录。

### D3: 整文件 JSON 数组

**选择**：每个对话存储为完整 JSON 数组，读写时替换整个文件。

**替代方案**：JSONL（每行一条消息，追加写入）。

**理由**：调试阶段消息量不大，JSON 数组可读性好、方便手动编辑和导入导出。JSONL 虽追加写入更高效，但可读性和手动编辑不如 JSON。后续消息量大时可迁移。

### D4: save_message 追加语义

**选择**：`save_message` command 接收单条消息，Rust 端读取现有文件、追加、写回。

**替代方案**：前端批量传所有消息覆盖写入。

**理由**：前端每次只有一条新消息，逐条追加更自然。避免前端维护"哪些消息已保存"的状态。

### D5: dirs crate 获取 home 目录

**选择**：使用 `dirs` crate 的 `home_dir()` 获取跨平台用户根目录。

**理由**：`std::env::var("HOME")` 在 Windows 上不可靠（Windows 用 `USERPROFILE`）。`dirs` crate 是 Rust 生态标准做法，跨平台一致。

## Risks / Trade-offs

- **并发写入** → 短期不会有问题（单用户桌面应用）。后续如果多窗口同时写同一文件，需要加文件锁。
- **大文件性能** → 整文件读写在消息量大时会变慢。当前可接受，后续可切 JSONL 或按时间分片。
- **磁盘空间** → 无容量限制策略。当前可接受。
