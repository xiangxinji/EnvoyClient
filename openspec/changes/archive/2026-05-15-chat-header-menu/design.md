## Context

ChatPanel header 当前结构为 `peerId + 在线状态`，无操作入口。聊天消息存储在两层：`useTeamClient` 的 `messages` Map（内存）和 `~/.envoy/history/{userId}/{peerId}.json`（Tauri 文件）。目前没有清除对话的机制。

## Goals / Non-Goals

**Goals:**
- header 右侧添加 ⋮ 下拉按钮，点击展开菜单
- 菜单包含"清除聊天记录"选项，带确认步骤
- 清除同时清理内存消息和磁盘历史文件

**Non-Goals:**
- 不做其他菜单选项（未来可扩展）
- 不做选择性删除（只支持全部清除）
- 不影响其他 peer 的对话

## Decisions

### 1. 纯 CSS dropdown，不引入新组件库

用 `v-if` + `ref<boolean>` 控制菜单显示，`@click.outside` 关闭。项目没有 UI 框架依赖，保持一致。

### 2. 清除前弹确认

用简单的 `confirm()` 对话框确认，防止误操作。不需要自定义 modal。

### 3. Tauri `delete_history` command

在 `lib.rs` 新增 `delete_history(my_id, peer_id)` command，调用 `history.rs` 删除对应 JSON 文件。与现有 `load_history`/`save_message` 模式一致。

## Risks / Trade-offs

- **[误删风险]** → `confirm()` 确认保护
- **[dropdown 点击外部关闭]** → 使用 Vue `@click.outside` 指令或 `addEventListener` + `removeEventListener` 方式
