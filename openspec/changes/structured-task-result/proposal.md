## Why

Member 完成任务后，结果以原始 JSON 存入 `task.resources[]`，Leader 在 TaskCard 中看到的是 `JSON.stringify` 后的不可读文本。执行过程（工具调用、命令执行）在 ReAct 循环结束后被丢弃，无法追溯。上传的文件资源未在任务模型中登记，Leader 无法查看和下载。需要将任务结果从单一 JSON 块改为结构化的三区展示：AI Summary（Markdown）、文件资源列表（含下载链接）、执行过程追踪（完整步骤时间线）。

## What Changes

- `reactLoop()` 返回值从 `string` 扩展为 `{ result: string, trace: AgentStep[] }`，保留完整执行历史
- `task.resources[]` 新增两种资源类型：`file-resource`（上传文件记录）和 `execution-trace`（执行步骤）
- Manager 后端：`POST /api/tasks/:id/result` 接收并持久化 trace；`POST /api/tasks/:id/resources` 上传文件时同步登记 file-resource
- TaskCard 重构为三区展示：Summary（Markdown 渲染）、Resources（文件列表 + 下载 URL）、Execution Trace（可折叠时间线）

## Capabilities

### New Capabilities
- `task-result-display`: 任务结果的结构化展示——AI Summary Markdown 渲染、文件资源列表与下载、执行过程时间线

### Modified Capabilities
- `member-react-agent`: reactLoop 返回值扩展为包含 trace 的结构化对象，doing() handler 提交结果时携带 trace 和上传文件记录

## Impact

- **Agent 层**: `src/agent/react.ts` 返回值变更，`src/composables/useAgent.ts` 适配新返回结构
- **Client 层**: `src/composables/useTeamClient.ts` doing() handler 提交结果时新增 trace 和 file-resource 数据
- **Manager 后端**: `manager/server/routes/messages.ts` result 和 resources 端点扩展，`envoy/packages/server/server.ts` addResource 支持新类型
- **Manager 前端**: TaskCard 组件重构，新增执行时间线子组件
- **类型定义**: `src/types.ts` TaskResource 类型扩展，`shared/types/` 新增 AgentStep 类型
- **无破坏性变更**: 现有 `client-result` 类型保持不变，新增类型为增量扩展
