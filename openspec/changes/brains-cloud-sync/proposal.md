## Why

客户端知识库（`~/.envoy/brains/{username}/`）目前仅存在于本地文件系统，没有备份或跨设备同步机制。用户在多台设备上工作时，技能文件无法共享；设备故障会导致知识库丢失。需要提供云端备份能力，让用户可以选择自动将本地知识库增量同步到 Manager 云存储。

## What Changes

- **Manager 新增 `routes/brains.ts`**：专用 brains sync API（`/api/brains/sync` 批量 upsert、`/api/brains/files` 列表、`/api/brains/download/*` 下载、`/api/brains/rename` 改名），存储在 `~/.envoy/teams/{team}/brains/{username}/`，独立于 cloud 资源
- 新增 `useBrainsSync` composable，管理增量同步全流程（扫描本地文件、hash 比对 manifest、调用 brains API 批量上传、改名已删除文件）
- 新增 MemberSettings 字段：`brains_sync_triggers`（多选：固定间隔 / 任务完成后）和 `brains_sync_interval_hours`
- 新增 Tauri 命令：`scan_brains_files`（递归扫描并计算 hash）、`restore_brains`（从云端恢复覆盖本地）
- SettingsTask 面板新增知识库同步设置区：触发器多选、同步间隔输入、进度条、恢复按钮
- 侧边栏底部新增同步状态指示器（同步中时显示旋转图标 + 文件进度）
- hook `useTeamClient` 任务完成事件，过滤仅自身参与的任务后触发同步
- 同步目标路径：Manager 端 `~/.envoy/teams/{team}/brains/{username}/`，单向推送 + 手动恢复
- 本地已删除文件在云端重命名为 `.backup.ext`，不直接删除

## Capabilities

### New Capabilities
- `brains-sync`: 知识库云端同步能力，包括增量同步逻辑、进度追踪、触发器管理、恢复操作

### Modified Capabilities
- `member-settings`: 新增 `brains_sync_triggers` 和 `brains_sync_interval_hours` 两个用户设置字段

## Impact

- **Manager 后端**：新建 `routes/brains.ts`，4 个 API endpoint（sync、files、download、rename），独立存储目录
- **Tauri Rust 层**：`brains.rs` 新增 `scan_brains_files`、`restore_brains` 命令；`lib.rs` 注册新命令
- **Composable 层**：新建 `useBrainsSync.ts`；修改 `useMemberSettings.ts` 新增字段；修改 `useTeamClient.ts` 注册任务完成触发器
- **UI 层**：修改 `SettingsTask/main.vue` 新增同步设置 section；修改 `MemberSidebar/main.vue` 新增同步指示器
- **i18n**：新增同步相关翻译 key
