## 1. 新增 useGlossarySync composable

- [x] 1.1 创建 `src/composables/useGlossarySync.ts`，实现 `syncGlossary(teamName, username)` 函数：调用 `GET /api/glossary?team={teamName}` 获取合并词汇数据
- [x] 1.2 实现词汇数据 → Markdown 转换逻辑（YAML frontmatter + `## term\ndefinition` 格式）
- [x] 1.3 使用 Tauri `file_write` 将转换后的 Markdown 写入 `~/glossary/system.md`，API 失败时静默跳过
- [x] 1.4 在写入前检查 `~/glossary/personal.md` 是否存在，不存在则创建带 frontmatter 的空文件

## 2. 集成到 useTeamClient

- [x] 2.1 在 `src/composables/useTeamClient.ts` 的 `connected` 事件回调中调用 `syncGlossary(conn.teamName, conn.myId)`

## 3. 移除 query_glossary 工具

- [x] 3.1 删除 `src/agent/tools.ts` 中的 `createGlossaryTool` 函数及 `GlossaryItem` 接口
- [x] 3.2 修改 `src/agent/agents/planner.ts`：移除 `createGlossaryTool` import 和工具数组中的引用
- [x] 3.3 修改 `src/agent/agents/executor.ts`：移除 `createGlossaryTool` import 和工具数组中的引用
- [x] 3.4 修改 `src/agent/agents/reviewer.ts`：移除 `createGlossaryTool` import 和工具数组中的引用
