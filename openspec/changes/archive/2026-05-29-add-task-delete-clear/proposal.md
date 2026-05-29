## Why

Manager 端缺少任务删除和清空功能，测试时积累的已完成/失败任务无法清理，只能手动操作数据库或重启。需要在后端 API 和前端 UI 中增加任务删除与清空能力，方便测试和日常维护。

## What Changes

- envoy Server 类新增 `removeTask(id)` 和 `removeAllTasks()` 方法，支持从内存中移除任务
- 后端 db.ts 新增 `deleteTask`、`deleteAllTasks`、`deleteTaskMessages` 数据库操作函数
- 后端新增 `DELETE /api/teams/:name/tasks/:id`（删除单任务）和 `DELETE /api/teams/:name/tasks`（清空所有任务）端点
- 删除时同步清理内存状态、SQLite 记录、文件系统目录和关联消息
- 前端 api.ts 新增对应的 API 调用方法
- 前端 TeamTasks 组件增加"清空所有"按钮和行内删除按钮
- 前端 TaskDetail 页面增加"删除任务"按钮
- 后端测试覆盖新增的数据库删除函数

## Capabilities

### New Capabilities
- `task-deletion`: 任务删除与清空能力，涵盖 envoy 内存层、SQLite 持久层、文件系统资源层和关联消息的完整清理

### Modified Capabilities

## Impact

- **envoy 包**: `packages/server/server.ts` 新增两个公开方法，影响 Server 类 API 但不改变现有行为
- **后端 API**: `routes/teams.ts` 新增两个 DELETE 端点；`db.ts` 新增三个函数
- **文件系统**: 删除时 `rm -rf` 任务目录（含 resources/）
- **前端**: `api.ts`、`TeamTasks.vue`、`TaskDetail.vue` 需修改
- **测试**: `tests/db/tasks.test.ts` 需扩展
