## ADDED Requirements

### Requirement: TaskService.dispatch 派发任务

TaskService SHALL 提供 `dispatch(targetIds: readonly string[], content: string)` 方法。方法 SHALL 通过 `managerPost` 向 `POST /api/tasks` 发送请求，body 包含 `from`（myId）、`content`、`subscribe`（targetIds）、`mode: "serial"`。

方法 SHALL 返回 `Promise<void>`。

#### Scenario: 派发任务给单个成员
- **WHEN** 调用 `dispatch(["member1"], "完成报告")`
- **THEN** POST body 为 `{ from: myId, content: "完成报告", subscribe: ["member1"], mode: "serial" }`

#### Scenario: 派发任务给多个成员
- **WHEN** 调用 `dispatch(["member1", "member2"], "协作任务")`
- **THEN** POST body 中 `subscribe: ["member1", "member2"]`

### Requirement: TaskService.start 开始执行任务

TaskService SHALL 提供 `start(taskId: string)` 方法。方法 SHALL 通过 `managerPost` 向 `POST /api/tasks/:taskId/start` 发送请求，body 包含 `{ from: myId }`。

方法 SHALL 返回 `Promise<void>`。

#### Scenario: 开始执行任务
- **WHEN** 调用 `start("task-123")`
- **THEN** POST /api/tasks/task-123/start，body 为 `{ from: myId }`

### Requirement: TaskService.complete 标记任务完成

TaskService SHALL 提供 `complete(taskId: string, data: Readonly<TaskCompleteData>)` 方法。方法 SHALL 通过 `managerPost` 向 `POST /api/tasks/:taskId/complete` 发送请求，body 包含 `from`（myId）和 `data`。

方法 SHALL 返回 `Promise<void>`。

#### Scenario: 手动标记完成
- **WHEN** 调用 `complete("task-123", { note: "手动完成", source: "manual" })`
- **THEN** POST body 为 `{ from: myId, data: { note: "手动完成", source: "manual" } }`

### Requirement: TaskService.submitResult 提交任务结果

TaskService SHALL 提供 `submitResult(taskId: string, result: Readonly<TaskSubmitResult>)` 方法。方法 SHALL 通过 `managerPost` 向 `POST /api/tasks/:taskId/result` 发送请求。

`TaskSubmitResult` 类型 SHALL 包含：`from: string`、`success: boolean`、可选的 `data`、可选的 `error`、可选的 `trace`。

方法 SHALL 返回 `Promise<void>`。

#### Scenario: 提交成功结果
- **WHEN** 调用 `submitResult("task-123", { from: myId, success: true, data: { result: "done", source: "ai" } })`
- **THEN** POST body 包含完整结果数据

#### Scenario: 提交失败结果
- **WHEN** 调用 `submitResult("task-123", { from: myId, success: false, error: "执行出错" })`
- **THEN** POST body 包含 `success: false` 和 `error`

#### Scenario: 提交 Leader 评审结果
- **WHEN** 调用 `submitResult("task-123", { from: myId, success: true, data: { review: "通过", source: "ai" } })`
- **THEN** POST body 包含评审数据

### Requirement: TaskService.uploadResource 上传任务资源文件

TaskService SHALL 提供 `uploadResource(taskId: string, file: File)` 方法。方法 SHALL 通过 `fetch` 向 `POST /api/tasks/:taskId/resources` 发送 `FormData`（包含 `file` 和 `from`），header 包含 `team: teamName`。

方法 SHALL 返回 `Promise<void>`。服务端返回非 2xx 时 SHALL throw Error。

#### Scenario: 上传资源成功
- **WHEN** 调用 `uploadResource("task-123", file)`
- **THEN** POST FormData 到 /api/tasks/task-123/resources

#### Scenario: 上传失败
- **WHEN** 服务端返回非 2xx
- **THEN** throw Error

### Requirement: TaskService.fetchDetail 获取任务详情

TaskService SHALL 提供 `fetchDetail(taskId: string)` 方法。方法 SHALL 通过 `managerFetch` 向 `GET /api/teams/:teamName/tasks/:taskId` 发送请求。

方法 SHALL 返回 `Promise<ApiTask>`。

#### Scenario: 获取任务详情成功
- **WHEN** 调用 `fetchDetail("task-123")`
- **THEN** 请求 `GET /api/teams/myTeam/tasks/task-123`，返回 `ApiTask` 对象

#### Scenario: 任务不存在
- **WHEN** taskId 对应的任务不存在
- **THEN** `managerFetch` throw Error（HTTP 404）

### Requirement: TaskService.downloadResourceUrl 获取资源下载链接

TaskService SHALL 提供 `downloadResourceUrl(taskId: string, filename: string)` 方法。方法 SHALL 返回 `string`，通过 `apiUrl('/api/tasks/' + taskId + '/resources/' + encodeURIComponent(filename))` 构造完整 URL。

此方法为纯函数，不发起 HTTP 请求。

#### Scenario: 构造资源下载 URL
- **WHEN** 调用 `downloadResourceUrl("task-123", "report.pdf")`
- **THEN** 返回 `"http://localhost:8080/api/tasks/task-123/resources/report.pdf"`

#### Scenario: 文件名含特殊字符
- **WHEN** 调用 `downloadResourceUrl("task-123", "中文 文件.pdf")`
- **THEN** 返回 URL 中 filename 部分经过 `encodeURIComponent` 编码
