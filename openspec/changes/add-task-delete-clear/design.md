## Context

当前任务系统只有创建和状态流转能力，没有删除/清空操作。任务进入 `completed` 或 `failed` 终态后永久留存，测试时积累大量无用数据。任务存在于三个层面：envoy Server 内存 Map、SQLite 数据库、文件系统目录，以及 messages 表中的关联通知消息。删除操作需要在这四个层面同步清理。

现有删除模式参考：`deleteMessage`、`deleteCloudFile`、`deleteSticker` 均为 `db.prepare("DELETE FROM ...").run()` + `info.changes > 0` 判断是否存在的模式。

## Goals / Non-Goals

**Goals:**
- 提供单任务删除和全部清空两个操作
- 在所有四个存储层面（内存、SQLite tasks、文件系统、关联 messages）完整清理
- 前端 UI 在任务列表和任务详情页都提供入口
- 遵循现有代码模式（DB 函数、路由结构、前端 confirm() 确认）

**Non-Goals:**
- 不做软删除/回收站机制
- 不做按状态批量删除（如只删 completed）
- 不做删除权限控制（管理员即可操作）
- 不处理 Agent 正在执行任务的优雅中断（直接删除）

## Decisions

### 1. envoy Server 新增 `removeTask` / `removeAllTasks`

在 `envoy/packages/server/server.ts` 的 Server 类中新增两个公开方法：

```ts
removeTask(taskId: string): boolean {
  return this.tasks.delete(taskId);
}

removeAllTasks(): number {
  const count = this.tasks.size;
  this.tasks.clear();
  return count;
}
```

**理由**: Server 的 `tasks` 是 `private Map`，外部无法直接操作。新增公开方法与现有 `getTask`/`getAllTasks`/`startTask` 保持一致的 API 风格。envoy 包本身也需要这些方法做测试清理。

**备选方案**: 不改 envoy 包，只清理持久化数据靠重启恢复。被否决，因为用户明确要求改 envoy 包。

### 2. 关联消息按 taskId 精确删除

使用 SQLite `json_extract(extra, '$.taskId')` 匹配：

```sql
DELETE FROM messages WHERE type = 'task' AND json_extract(extra, '$.taskId') = ?
```

**理由**: `persistTask()` 插入的消息结构为 `{ type: "task", subtype: "task:{status}", extra: { taskId, ... } }`。清空时直接 `DELETE FROM messages WHERE type = 'task'`。

### 3. 文件系统清理

删除单任务时 `rm -rf` 整个 `~/.envoy/teams/{name}/tasks/{id}/` 目录。清空时遍历 `tasks/` 目录下所有子目录逐一删除（保留 tasks/ 目录本身）。

使用 `team-registry.ts` 已有的 `getTaskDir()` 函数获取路径。

### 4. API 端点设计

```
DELETE /api/teams/:name/tasks/:id   → 删除单任务
DELETE /api/teams/:name/tasks       → 清空所有任务
```

放在 `routes/teams.ts`（而非 `routes/messages.ts`），因为任务列表查询端点已经在 teams.ts 中，且这些是管理员操作，不需要 `team` header 的客户端认证。

### 5. 前端 UI 模式

使用原生 `confirm()` 对话框确认，与 Users/Teams/Models 的删除操作保持一致。不使用自定义 Modal。

## Risks / Trade-offs

- **[运行中任务被删]** → Agent 执行结果上报时 task 已不存在，`receiveResult` 会找不到 task。这是可接受的（测试场景），不影响系统稳定性。
- **[批量清空性能]** → 任务量大时逐个清理文件系统目录可能较慢。但这是管理员操作且频率低，可接受。
- **[json_extract 索引]** → messages 表的 `extra` 字段无 JSON 索引，但数据量小（团队级别），性能无影响。
