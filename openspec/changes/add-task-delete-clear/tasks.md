## 1. Envoy Server 内存层

- [x] 1.1 在 `envoy/packages/server/server.ts` 的 Server 类中新增 `removeTask(taskId: string): boolean` 方法，从 `this.tasks` Map 中 delete 并返回结果
- [x] 1.2 在同一文件中新增 `removeAllTasks(): number` 方法，清空 `this.tasks` Map 并返回移除数量

## 2. 后端数据库层

- [x] 2.1 在 `manager/server/db.ts` 中新增 `deleteTask(teamName, taskId): boolean`，执行 `DELETE FROM tasks WHERE id = ?`
- [x] 2.2 在 `manager/server/db.ts` 中新增 `deleteAllTasks(teamName): number`，执行 `DELETE FROM tasks`
- [x] 2.3 在 `manager/server/db.ts` 中新增 `deleteTaskMessages(teamName, taskId): number`，执行 `DELETE FROM messages WHERE type = 'task' AND json_extract(extra, '$.taskId') = ?`
- [x] 2.4 在 `manager/server/db.ts` 中新增 `deleteAllTaskMessages(teamName): number`，执行 `DELETE FROM messages WHERE type = 'task'`

## 3. 后端测试

- [x] 3.1 在 `manager/server/tests/db/tasks.test.ts` 中新增 `deleteTask` 测试：删除存在任务返回 true、删除不存在返回 false
- [x] 3.2 新增 `deleteAllTasks` 测试：清空有任务的团队返回正确数量、清空空团队返回 0
- [x] 3.3 新增 `deleteTaskMessages` 测试：验证关联消息被正确删除

## 4. 后端 API 端点

- [x] 4.1 在 `manager/server/routes/teams.ts` 中新增 `DELETE /api/teams/:name/tasks/:id` 端点：依次调用 `innerServer.removeTask` → `deleteTask` → `deleteTaskMessages` → `rm -rf` 任务目录
- [x] 4.2 在同一文件中新增 `DELETE /api/teams/:name/tasks` 端点：依次调用 `innerServer.removeAllTasks` → `deleteAllTasks` → `deleteAllTaskMessages` → 遍历清空 tasks 目录下子目录

## 5. 前端 API 客户端

- [x] 5.1 在 `manager/web/src/api.ts` 中新增 `deleteTask(team: string, id: string)` 方法，调用 `DELETE /teams/${team}/tasks/${id}`
- [x] 5.2 在同一文件中新增 `deleteAllTasks(team: string)` 方法，调用 `DELETE /teams/${team}/tasks`

## 6. 前端 UI

- [x] 6.1 修改 `manager/web/src/components/TeamTasks.vue`：在筛选栏右侧添加"清空所有"按钮，带 confirm 确认
- [x] 6.2 修改 `manager/web/src/components/TaskTable.vue`：在操作列添加行内删除按钮（🗑 .btn-delete），emit delete 事件
- [x] 6.3 修改 `TeamTasks.vue`：监听 TaskTable 的 delete 事件，调用 `deleteTask` API 并刷新
- [x] 6.4 修改 `manager/web/src/views/TaskDetail.vue`：在顶部操作区添加"删除任务"按钮，删除后导航回团队任务列表
