## ADDED Requirements

### Requirement: Server 内存层任务移除
envoy Server 类 SHALL 提供 `removeTask(taskId: string): boolean` 方法，从内部 tasks Map 中移除指定任务。任务存在时返回 `true`，不存在时返回 `false`。

#### Scenario: 移除存在的任务
- **WHEN** 调用 `removeTask("task-1")` 且 tasks Map 中存在该 ID
- **THEN** 该任务从 Map 中移除，返回 `true`

#### Scenario: 移除不存在的任务
- **WHEN** 调用 `removeTask("ghost")` 且 tasks Map 中不存在该 ID
- **THEN** Map 不变，返回 `false`

### Requirement: Server 内存层全部任务清空
envoy Server 类 SHALL 提供 `removeAllTasks(): number` 方法，清空内部 tasks Map 并返回被移除的任务数量。

#### Scenario: 清空有任务的 Map
- **WHEN** tasks Map 中有 5 个任务，调用 `removeAllTasks()`
- **THEN** Map 变为空，返回 `5`

#### Scenario: 清空空 Map
- **WHEN** tasks Map 为空，调用 `removeAllTasks()`
- **THEN** Map 仍为空，返回 `0`

### Requirement: SQLite 任务记录删除
后端 SHALL 提供 `deleteTask(teamName: string, taskId: string): boolean` 函数，从 tasks 表删除指定任务记录。

#### Scenario: 删除存在的任务
- **WHEN** 调用 `deleteTask("team-a", "task-1")` 且该任务存在
- **THEN** tasks 表中该记录被删除，返回 `true`

#### Scenario: 删除不存在的任务
- **WHEN** 调用 `deleteTask("team-a", "ghost")`
- **THEN** 返回 `false`

### Requirement: SQLite 全部任务清空
后端 SHALL 提供 `deleteAllTasks(teamName: string): number` 函数，删除该团队 tasks 表中的所有记录并返回删除数量。

#### Scenario: 清空有任务的团队
- **WHEN** 团队有 10 个任务，调用 `deleteAllTasks("team-a")`
- **THEN** tasks 表清空，返回 `10`

#### Scenario: 清空无任务的团队
- **WHEN** 团队没有任务，调用 `deleteAllTasks("team-a")`
- **THEN** 返回 `0`

### Requirement: 关联任务消息删除
后端 SHALL 提供 `deleteTaskMessages(teamName: string, taskId: string): number` 函数，从 messages 表中删除所有 `type='task'` 且 `extra.taskId` 匹配的消息记录。

#### Scenario: 删除任务的关联消息
- **WHEN** 某任务有 3 个 subscriber，状态流转产生了 6 条 type='task' 消息
- **THEN** 调用 `deleteTaskMessages("team-a", "task-1")` 返回 `6`，这些消息被删除

#### Scenario: 任务无关联消息
- **WHEN** 调用 `deleteTaskMessages("team-a", "ghost")`
- **THEN** 返回 `0`

### Requirement: 删除单任务 API 端点
后端 SHALL 提供 `DELETE /api/teams/:name/tasks/:id` 端点，执行单任务删除，依次清理：Server 内存 → SQLite tasks 表 → 关联 messages → 文件系统目录。

#### Scenario: 成功删除任务
- **WHEN** 发送 `DELETE /api/teams/my-team/tasks/task-1`
- **THEN** 返回 `{ ok: true, deleted: "task-1" }`，四层存储全部清理

#### Scenario: 任务不存在
- **WHEN** 发送 `DELETE /api/teams/my-team/tasks/ghost`
- **THEN** 返回 `{ ok: true, deleted: null, note: "task not found in db" }`（仍尝试清理内存）

#### Scenario: 团队不存在
- **WHEN** 发送 `DELETE /api/teams/nonexistent/tasks/task-1`
- **THEN** 返回 `{ error: "team not found" }`，状态码 404

### Requirement: 清空所有任务 API 端点
后端 SHALL 提供 `DELETE /api/teams/:name/tasks` 端点，清空该团队所有任务，依次清理：Server 内存全部任务 → SQLite tasks 表全部记录 → messages 表所有 type='task' 记录 → 文件系统 tasks 目录下所有子目录。

#### Scenario: 成功清空
- **WHEN** 发送 `DELETE /api/teams/my-team/tasks`，团队有 5 个任务
- **THEN** 返回 `{ ok: true, deletedCount: 5 }`，四层存储全部清理

#### Scenario: 团队不存在
- **WHEN** 发送 `DELETE /api/teams/nonexistent/tasks`
- **THEN** 返回 `{ error: "team not found" }`，状态码 404

### Requirement: 前端任务列表删除按钮
TeamTasks 组件 SHALL 在任务表操作列提供单行删除按钮（🗑），点击后弹出 `confirm()` 确认，确认后调用 API 删除并刷新列表。

#### Scenario: 点击行内删除
- **WHEN** 用户点击某任务行的删除按钮并确认
- **THEN** 调用 `deleteTask` API，成功后自动刷新任务列表

#### Scenario: 取消删除
- **WHEN** 用户点击删除按钮但在 confirm 对话框中取消
- **THEN** 不执行任何操作

### Requirement: 前端任务列表清空按钮
TeamTasks 组件 SHALL 在筛选栏右侧提供"清空所有"按钮，点击后弹出 `confirm()` 确认（含"此操作不可恢复"提示），确认后调用 API 清空并刷新列表。

#### Scenario: 点击清空并确认
- **WHEN** 用户点击"清空所有"按钮并确认
- **THEN** 调用 `deleteAllTasks` API，成功后自动刷新任务列表

### Requirement: 前端任务详情页删除按钮
TaskDetail 视图 SHALL 在顶部操作区提供"删除任务"按钮，点击后弹出 `confirm()` 确认，确认后调用 API 删除并返回团队任务列表页。

#### Scenario: 在详情页删除任务
- **WHEN** 用户在任务详情页点击"删除任务"并确认
- **THEN** 调用 `deleteTask` API，成功后导航回 `/teams/{name}` 的任务 tab
