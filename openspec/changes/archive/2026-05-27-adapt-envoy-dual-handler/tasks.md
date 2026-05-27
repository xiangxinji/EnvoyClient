## 1. useConnection.ts — 移除废弃选项

- [x] 1.1 删除 `useConnection.ts` 第 23 行的 `autoSendResult: false`，改为 `const clientOpts = { ...options };`

## 2. useTaskExecution.ts — 拆分 handler

- [x] 2.1 在 `registerHandler` 函数中，将 `client.doing()` 内部的 `taskStatus === "reviewing"` 分支移除，只保留 Member 执行逻辑（设置 `currentClientTask` + Promise 等待）
- [x] 2.2 在 `registerHandler` 中新增 `client.reviewing(async (clientTask) => handleLeaderReview(clientTask))` 调用，注册独立审核 handler
- [x] 2.3 更新 `registerHandler` 的 `client` 参数类型定义，添加 `reviewing` 方法签名

## 3. 验证

- [x] 3.1 确认 TypeScript 编译无错误（`ClientOptions` 不含 `autoSendResult`，`ClientTask` 不含 `status`）
- [x] 3.2 确认 Leader 连接后 `doing()` 和 `reviewing()` 均已注册，review 任务不会阻塞队列
- [x] 3.3 确认 Member 执行流程不变：`currentClientTask` 桥接到 UI，`resolveCurrentTask` 通过 HTTP API 提交结果
