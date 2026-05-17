## 1. 数据库与存储基础

- [x] 1.1 在 `manager/server/db.ts` 中新增 `cloud_files` 表 schema（CREATE TABLE + 索引），在 `initTeamDatabase` 中执行创建
- [x] 1.2 在 `db.ts` 中新增 `CloudFileRecord` 类型定义和 DB CRUD 函数：`insertCloudFile`、`queryCloudDir`、`deleteCloudFile`、`deleteCloudDirRecursive`、`getCloudStats`
- [x] 1.3 在 `manager/server/team-registry.ts` 中新增 `getCloudDir(teamName)` 函数，返回 `~/.envoy/teams/{teamName}/cloud/` 路径

## 2. Manager 云资源 API

- [x] 2.1 新建 `manager/server/routes/cloud.ts`，实现路径安全验证辅助函数（resolve + normalize + 前缀检查）
- [x] 2.2 实现 `GET /api/cloud/files` — 目录浏览端点（单层列表，path query 参数）
- [x] 2.3 实现 `POST /api/cloud/files` — 文件上传端点（formData: file + path + uploadedBy，同名检测返回 409）
- [x] 2.4 实现 `GET /api/cloud/download/*path` — 文件下载端点（带 Content-Disposition）
- [x] 2.5 实现 `POST /api/cloud/directories` — 创建目录端点（同名检测返回 409，自动创建中间目录）
- [x] 2.6 实现 `DELETE /api/cloud/files` — 删除文件/目录端点（仅 Leader，级联删除目录及子项，Member 返回 403）
- [x] 2.7 实现 `GET /api/cloud/stats` — 使用统计端点（totalFiles、totalSize、totalDirs、byUser 分布）
- [x] 2.8 在 `manager/server/index.ts` 中注册 `cloudRoutes`，传入 `teams` Map 和 `getCloudDir`

## 3. 客户端 API 封装

- [x] 3.1 在 `src/api.ts` 中新增云资源 API 函数：`listCloudFiles`、`uploadCloudFile`、`downloadCloudFile`、`createCloudDirectory`、`deleteCloudFile`、`getCloudStats`

## 4. 客户端 UI

- [x] 4.1 在 `MemberSidebar.vue` 中新增"云资源"导航项（`__cloud__`），位于任务中心入口上方，使用云朵图标
- [x] 4.2 在 `ChatView.vue` 中新增 `__cloud__` 面板分支，加载 `CloudResourcesPanel` 组件
- [x] 4.3 新建 `src/components/CloudResourcesPanel.vue`：面包屑导航 + 文件/目录列表（图标、名称、大小、上传者、时间）
- [x] 4.4 实现目录导航：点击目录项进入子目录，面包屑点击跳转到任意层级
- [x] 4.5 实现文件上传：上传按钮触发文件选择，调用上传 API，刷新列表
- [x] 4.6 实现创建目录：按钮触发输入，调用创建目录 API，刷新列表
- [x] 4.7 实现文件下载：点击文件下载按钮，调用下载 API，通过 Tauri `downloadFileWithDialog` 保存
- [x] 4.8 实现删除操作：Leader 角色显示删除按钮，二次确认后调用删除 API，刷新列表；Member 隐藏删除按钮
- [x] 4.9 新增国际化 key（sidebar.cloudResources 及面板内文案）到 i18n 配置

## 5. Agent 工具集成

- [x] 5.1 在 `src/agent/tools.ts` 中新增 `cloud_list` 工具定义（参数：path，调用 `GET /api/cloud/files`）
- [x] 5.2 在 `src/agent/tools.ts` 中新增 `cloud_upload` 工具定义（参数：path + filename + content，调用 `POST /api/cloud/files`）
- [x] 5.3 在 `src/composables/useTaskExecution.ts` 中将 `cloud_list` 和 `cloud_upload` 加入 Agent 工具集

## 6. Manager 管理后台

- [x] 6.1 在 `manager/web/src/views/TeamDetail.vue` 中新增云资源统计区块（文件总数、总大小、按用户分布），调用 `GET /api/cloud/stats`
