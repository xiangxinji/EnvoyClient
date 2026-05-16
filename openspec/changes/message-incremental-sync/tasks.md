## 1. Manager SQLite Infrastructure

- [x] 1.1 Install better-sqlite3 and @types/better-sqlite3 in manager/server
- [x] 1.2 Create `manager/server/db.ts`: initTeamDatabase(teamDir) 为每个 team 创建 ~/.envoy/teams/{teamName}/messages.db，建表 messages + 索引（seq per-team 递增，无 team 列）
- [x] 1.3 维护 team name → database 实例映射，insertMessage(teamName, msg) INSERT 到对应 db，返回 `{ id: uuid, seq: number }`
- [x] 1.4 Create queryMessages(teamName, opts) 函数：按 user + after_seq 查询，支持 limit + has_more
- [x] 1.5 Create queryConversations(teamName, user) 函数：返回会话摘要列表
- [x] 1.6 在 team 创建/恢复时调用 initTeamDatabase()

## 2. Manager Routes — Message Send + Sync

- [x] 2.1 改造 `POST /api/messages` (routes/messages.ts)：relay 前 INSERT 到 SQLite，返回 `{ id, seq }`
- [x] 2.2 relay payload 中注入 server 分配的 id 和 seq 字段
- [x] 2.3 新增 `GET /api/messages/sync`：接受 team/after_seq/limit 参数，调用 queryMessages 返回增量结果
- [x] 2.4 新增 `GET /api/messages/conversations`：接受 team/user 参数，调用 queryConversations 返回会话列表

## 3. Manager — Task Event Persistence

- [x] 3.1 在 `setupTaskPersistence()` 中为 task:created/updated/completed/failed 事件增加 insertMessage 调用
- [x] 3.2 任务消息的 extra 字段包含 taskId, status, subscribe, resources

## 4. Client — Types Update

- [x] 4.1 `src/types.ts`: ChatMessage 增加 `seq: number` 字段
- [x] 4.2 `src/types.ts`: TaskMessage 增加 `seq: number` 字段

## 5. Client — useMessages.ts Refactor

- [x] 5.1 `sendChat()` 改用 managerPost 返回的 `{ id, seq }` 替代 `${Date.now()}-local` 临时 ID
- [x] 5.2 移除 `sendChat()` 中的 `invoke("save_message")` 调用
- [x] 5.3 `handleIncomingMessage()` 使用 relay 消息中携带的 server id 和 seq
- [x] 5.4 移除 `handleIncomingMessage()` 中的 `invoke("save_message")` 调用
- [x] 5.5 `loadHistory()` 改为调用 `GET /api/messages/sync` API，循环拉取直到 has_more=false
- [x] 5.6 移除 `loadHistory()` 中的 `invoke("load_all_history")` 调用

## 6. Client — useTeamClient.ts Update

- [x] 6.1 连接事件中调用新的 `loadHistory()`（HTTP sync 替代 Tauri invoke）
- [x] 6.2 确保任务消息也通过 sync API 拉取并正确显示

## 7. Tauri Backend Cleanup

- [x] 7.1 删除 `src-tauri/src/history.rs` 文件
- [x] 7.2 从 `src-tauri/src/lib.rs` 中移除 save_message, load_history, load_all_history, delete_history, export_history, import_history commands
- [x] 7.3 清理 lib.rs 中的 mod history 声明和相关 use 语句

## 8. Client — Remove Local Storage References

- [x] 8.1 搜索并移除所有 `invoke("save_message")` 残留引用
- [x] 8.2 搜索并移除所有 `invoke("load_history")` / `invoke("load_all_history")` 残留引用
- [x] 8.3 移除 ChatPanel.vue 中的 export/import history 功能（如有引用）
- [x] 8.4 清理 safeInvoke 中不再需要的 history 相关类型
