## Why

Member 执行任务并上传文件到云资源时，所有文件都上传到根目录，导致云盘结构混乱、难以管理。需要让 AI 在上传时自动推理文件应归属的目录，实现智能归类。

## What Changes

- 新增 `POST /api/cloud/smart-upload` 端点：接收文件内容 + 文件描述，后端通过 AI 推理目标目录路径，自动创建目录并保存文件
- 新增 `cloud_organize` AI 场景：用于文件目录分类推理，使用 `generateObject` + Zod schema 输出结构化的目录路径
- 新增 `smart_upload` Agent 工具：替代 Executor 直接调用 `cloud_upload`，AI 只需提供文件名和简单描述
- 新增递归目录树查询函数：获取仅包含目录的树形结构供 AI 推理使用

## Capabilities

### New Capabilities
- `smart-cloud-upload`: 智能云资源上传能力——AI 根据文件描述自动推理归属目录，支持目录自动创建和文件保存

### Modified Capabilities

## Impact

- **后端 API**: `manager/server/routes/cloud.ts` 新增端点
- **AI 场景系统**: `shared/types/ai.ts` SceneType 新增 `"cloud_organize"`；`manager/server/services/ai/` 新增 handler 和 prompt
- **数据库层**: `manager/server/db.ts` 新增目录树查询函数
- **Agent 工具**: `src/agent/services/cloudService.ts` 新增 `smart_upload` operation
- **Agent 指令**: `src/agent/agents/executor.ts` instructions 引导优先使用 `smart_upload`
- **向后兼容**: 原 `cloud_upload` / `cloud_upload_file` 工具保留不动，`smart_upload` 是更高层封装
