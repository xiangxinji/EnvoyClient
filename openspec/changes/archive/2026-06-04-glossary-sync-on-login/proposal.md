## Why

词汇表数据目前只存在于服务端 SQLite，Agent 通过 API 实时查询。将词汇同步到本地知识库目录后，数据在本地持久可用，为后续离线访问和个人词汇管理奠定基础。同时在加入团队时自动同步，无需用户手动操作。

## What Changes

- 新增 `useGlossarySync` composable，在加入团队时将合并后的词汇表（全局+团队）写入本地 `~/.envoy/brains/{user}/glossary/system.md`
- 首次加入时创建空的个人词汇文件 `~/.envoy/brains/{user}/glossary/personal.md`
- 切换团队时仅重新同步 system.md，不覆盖 personal.md
- 移除 `query_glossary` Agent 工具（`src/agent/tools.ts` 中的 `createGlossaryTool`）及其在 planner、executor、reviewer 中的引用

## Capabilities

### New Capabilities
- `glossary-local-sync`: 加入团队时将服务端词汇表同步到本地知识库目录，支持系统和个人两级词汇文件

### Modified Capabilities

## Impact

- **前端新增文件**: `src/composables/useGlossarySync.ts`
- **前端修改文件**: `src/composables/useTeamClient.ts`（connected 事件中调用 glossary sync）
- **Agent 层删除**: `src/agent/tools.ts` 中的 `createGlossaryTool` 函数
- **Agent 层修改**: `src/agent/agents/planner.ts`、`executor.ts`、`reviewer.ts` 移除 glossary 工具引用
- **服务端**: 无变更，复用现有 `GET /api/glossary?team=X` 端点
- **本地文件系统**: 新增 `~/.envoy/brains/{user}/glossary/` 目录及其中文件
