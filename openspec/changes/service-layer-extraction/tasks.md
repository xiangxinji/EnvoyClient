## 1. 基础设施

- [x] 1.1 创建 `src/services/types.ts` — 定义 `ServiceConfig`、`SendOptions`、`SendResult`、`TaskCompleteData`、`TaskSubmitResult` 等共享类型，从 `api.ts` 和 `types.ts` 迁移 `CloudFileItem`、`CloudDirListing`、`CloudSearchResult`、`CloudStats`、`UserProfile`
- [x] 1.2 创建 `src/services/MessageService.ts` — class + `getConfig` 注入，实现 `send`、`revoke`、`uploadAttachment` 三个方法
- [x] 1.3 创建 `src/services/CloudResourceService.ts` — class + `getConfig` 注入，实现 8 个方法（listFiles / uploadFile / createDirectory / deleteFile / downloadUrl / search / validatePaths / getStats）
- [x] 1.4 创建 `src/services/TaskService.ts` — class + `getConfig` 注入，实现 7 个方法（dispatch / start / complete / submitResult / uploadResource / fetchDetail / downloadResourceUrl）
- [x] 1.5 创建 `src/services/UserProfileService.ts` — class + `getConfig` 注入，实现 3 个方法（fetchProfiles / updateProfile / uploadAvatar）
- [x] 1.6 在 `teamClientContext.ts` 中实例化 4 个 Service 并导出 getter 函数

## 2. Composable 迁移

- [x] 2.1 迁移 `useMessages.ts` — `sendChat` 改用 `MessageService.send`，`revokeMessage` 改用 `MessageService.revoke`，移除直接 `managerPost` 调用
- [x] 2.2 迁移 `useFileUpload.ts` — `uploadImages` 和 `uploadPendingFiles` 改用 `MessageService.uploadAttachment`，移除直接 `fetch(apiUrl("/api/messages/attachments"))`
- [x] 2.3 迁移 `useTaskActions.ts` — 全部操作改用 `TaskService`（start / complete / submitResult / uploadResource），移除 `managerPost` 和 `apiUrl` 直接调用
- [x] 2.4 迁移 `useTaskExecution.ts` — `postToManager` 内联函数替换为 `TaskService` 方法调用（start / submitResult）
- [x] 2.5 迁移 `useTaskLiveData.ts` — `fetchTask` 改用 `TaskService.fetchDetail`
- [x] 2.6 迁移 `useTeamClient.ts` — `dispatchTask` 改用 `TaskService.dispatch`
- [x] 2.7 迁移 `useUserProfile.ts` — `loadProfiles`、`updateMyProfile`、`uploadMyAvatar` 改用 `UserProfileService`

## 3. 组件迁移

- [x] 3.1 迁移 `CloudResourcesPanel/main.vue` — 移除对 `api.ts` cloud 函数的直接 import，改用 `CloudResourceService`
- [x] 3.2 迁移 `TaskCenterView/main.vue` — 保留 `managerFetch`（query 操作，非 command，不在 Service 范围内）
- [x] 3.3 迁移 `CloudMentionPopup/main.vue` — `searchCloudFiles` 改用 `CloudResourceService.search`
- [x] 3.4 迁移 `BubbleContent/main.vue` — `validateCloudPaths` / `cloudDownloadUrl` 改用 `CloudResourceService`
- [x] 3.5 迁移 `useCloudMention.ts` — `CloudSearchResult` 类型改为从 `services/types.ts` 导入

## 4. 清理

- [x] 4.1 清理 `api.ts` — 移除已迁移到 Service 的 cloud 函数和 profile 函数，保留 `setManagerUrl` / `setClientToken` / `getClientToken` / `apiUrl` / `managerFetch` / `managerPost`
- [x] 4.2 清理 `src/types.ts` — 无需改动（CloudFileItem 等类型原来在 api.ts 而非 types.ts）
- [x] 4.3 全局检查 — 确认无 `.vue` 或 `.ts` 文件直接 import `api.ts` 中已移除的函数
