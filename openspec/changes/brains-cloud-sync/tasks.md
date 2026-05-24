## 1. Tauri 命令

- [x] 1.1 在 `brains.rs` 中新增 `scan_brains_files` 命令：递归扫描 `~/.envoy/brains/{username}/`，排除 `.sync_manifest.json` 和隐藏文件，返回 `{ files: [{ path, hash, size }] }`
- [x] 1.2 在 `brains.rs` 中新增 `restore_brains` 命令：接收 `{ username, files: [{ path, content }] }`，创建缺失目录并写入文件
- [x] 1.3 在 `lib.rs` 中注册 `scan_brains_files` 和 `restore_brains` 命令

## 2. MemberSettings 扩展

- [x] 2.1 在 `useMemberSettings.ts` 的 `MemberSettings` 接口中新增 `brains_sync_triggers` 和 `brains_sync_interval_hours`
- [x] 2.2 在 `loadSettings` 中添加新字段的解析逻辑（默认 `[]` 和 `1`）
- [x] 2.3 在 `saveSettings` 中添加新字段的持久化逻辑

## 3. Manager 端 brains sync API

- [x] 3.1 创建 `manager/server/routes/brains.ts`，实现 `POST /api/brains/sync`：接收 `{ username, files: [{ path, content }] }`，批量 upsert 到 `~/.envoy/teams/{team}/brains/{username}/`
- [x] 3.2 实现 `GET /api/brains/files`：列出指定用户的所有备份文件（排除 `.backup.*`）
- [x] 3.3 实现 `GET /api/brains/download/*`：下载指定备份文件
- [x] 3.4 实现 `POST /api/brains/rename`：服务端原子改名（用于本地删除后云端改名 `.backup.ext`）
- [x] 3.5 在 `manager/server/index.ts` 中注册 `brainsRoutes`

## 4. useBrainsSync Composable（重构为调用 brains API）

- [x] 4.1 重构 `doSync()` 中的上传逻辑：改为调用 `POST /api/brains/sync` 批量上传，而非逐个调用 `CloudResourceService.uploadFile`
- [x] 4.2 重构已删除文件处理：改为调用 `POST /api/brains/rename` 服务端改名，而非客户端下载+重传+删除三步 hack
- [x] 4.3 重构 `doRestore()` 中的列表和下载逻辑：改为调用 `GET /api/brains/files` 和 `GET /api/brains/download/*`

## 5. useTeamClient 集成

- [x] 5.1 在 `useTeamClient.ts` 的 task 事件监听器中，当 `task.status === "completed"` 且 `task.subscribe.includes(myId)` 且设置包含 `"after_task"` 时触发同步
- [x] 5.2 在 TeamClient 连接建立后调用 `brainsSync.setupTriggers()`，连接断开时调用 `cleanupTriggers()`

## 6. UI — SettingsTask 同步设置区

- [x] 6.1 在 `SettingsTask/main.vue` 新增"知识库云同步" section（触发器多选、间隔输入）
- [x] 6.2 新增同步状态展示区（进度条、成功/错误状态）
- [x] 6.3 新增"从云端恢复知识库"按钮（useConfirm 危险确认）

## 7. UI — 侧边栏同步指示器

- [x] 7.1 在 `MemberSidebar/main.vue` 底部新增同步状态指示器

## 8. i18n 国际化

- [x] 8.1 在 `zh-CN.json` 和 `en.json` 中新增同步相关翻译 key
