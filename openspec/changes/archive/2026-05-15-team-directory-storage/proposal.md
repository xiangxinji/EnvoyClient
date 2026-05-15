## Why

当前团队信息集中在 teams.json，任务数据仅存内存。需要按团队隔离存储，支持任务持久化和文件上传。

## What Changes

- 团队创建时建立 `~/.envoy/teams/{name}/` 目录 + `meta.json`（含 leader、members）
- 废弃 teams.json，改为扫描目录读取团队列表
- 任务事件（created/updated/completed/failed）持久化到 `tasks/{taskId}/task.json`
- 结果提交持久化到 `tasks/{taskId}/resources/{memberId}.json`
- 新增 `POST /api/tasks/:id/resources` multipart 文件上传接口
- 团队删除时清理对应目录

## Capabilities

### New Capabilities
- `team-directory-storage`: 按团队隔离的文件存储，含 meta.json、任务持久化、资源文件上传

## Impact

- **team-registry.ts**: loadRegistry/saveRegistry 改为目录扫描 + meta.json 读写
- **Server 事件**: Manager 订阅 task 事件写入磁盘
- **Manager routes**: 新增上传路由
- **teams.json**: 废弃，迁移到目录结构
