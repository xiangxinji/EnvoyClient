## 1. Tauri 后端

- [x] 1.1 在 `src-tauri/src/history.rs` 中新增 `delete_history(my_id, peer_id)` 函数，删除 `~/.envoy/history/{my_id}/{peer_id}.json`
- [x] 1.2 在 `src-tauri/src/lib.rs` 中注册 `delete_history` Tauri command

## 2. Client 数据层

- [x] 2.1 在 `src/composables/useTeamClient.ts` 中新增 `clearConversation(peerId)` 方法：清空 `messages` Map 中该 peer 的条目，调用 `invoke("delete_history")`
- [x] 2.2 将 `clearConversation` 从 return 对象中导出

## 3. UI 层

- [x] 3.1 在 `src/components/ChatPanel.vue` header 右侧添加 ⋮ 按钮，`ref` 控制菜单展开/关闭
- [x] 3.2 实现 dropdown 菜单，包含"清除聊天记录"选项，点击外部关闭
- [x] 3.3 实现 `handleClearChat()` 方法：`confirm()` 确认后调用 `clearConversation(peerId)`
- [x] 3.4 样式适配：dropdown 样式使用 CSS 变量实现 dark/light 双色逻辑
