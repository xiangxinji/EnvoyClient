## ADDED Requirements

### Requirement: Pipeline 结果写入 outbox 文件
系统 SHALL 在 task pipeline 执行完成后，将结果（success, data, error, trace）写入本地 outbox 文件 `~/.envoy/outbox/{teamName}/{taskId}.json`，然后再提交到服务端。

#### Scenario: Pipeline 完成后写 outbox
- **WHEN** pipeline 执行完成（无论 success 或 fail），运行在 Tauri 环境
- **THEN** 系统将完整结果写入 `~/.envoy/outbox/{teamName}/{taskId}.json`，文件内容为 JSON 格式包含 `from`, `success`, `data`, `error`, `trace`, `teamName`, `taskId` 字段

#### Scenario: Browser mode 不写 outbox
- **WHEN** pipeline 执行完成，运行在浏览器环境（非 Tauri）
- **THEN** 系统跳过 outbox 写入，直接进行 await + 重试提交

#### Scenario: Outbox 目录不存在
- **WHEN** `~/.envoy/outbox/{teamName}/` 目录不存在
- **THEN** 系统自动创建目录后再写入文件

### Requirement: Await + 重试提交结果
系统 SHALL 使用 `await` 调用 `taskService.submitResult()`，失败时进行最多 3 次指数退避重试（1s, 2s, 4s）。

#### Scenario: 首次提交成功
- **WHEN** `submitResult()` HTTP POST 成功
- **THEN** 系统删除对应的 outbox 文件，handler 正常返回

#### Scenario: 重试后成功
- **WHEN** 第一次 POST 失败，第二次 POST 成功
- **THEN** 系统删除 outbox 文件，handler 正常返回

#### Scenario: 全部重试失败
- **WHEN** 3 次 POST 全部失败
- **THEN** 系统保留 outbox 文件，log error，handler 仍然返回结果（不阻塞队列）

#### Scenario: Browser mode 重试失败
- **WHEN** browser mode 下 3 次 POST 全部失败
- **THEN** 系统 log error，handler 返回结果，无本地文件保留

### Requirement: 启动时扫描 outbox
系统 SHALL 在客户端启动（连接到 Server）成功后，扫描 outbox 目录中未提交的结果文件并重发。

#### Scenario: 启动时发现未提交结果
- **WHEN** 客户端启动并连接成功，outbox 目录中存在 `{taskId}.json` 文件
- **THEN** 系统读取每个文件，调用 `taskService.submitResult()` 提交，成功后删除文件

#### Scenario: 启动时 outbox 为空
- **WHEN** 客户端启动，outbox 目录为空或不存在
- **THEN** 不执行任何操作

#### Scenario: 启动时提交失败
- **WHEN** 启动扫描时某文件的 POST 仍然失败
- **THEN** 保留文件，下次启动时再次尝试

### Requirement: WebSocket 重连时扫描 outbox
系统 SHALL 在 WebSocket 重新连接成功后，扫描 outbox 目录并重发未提交的结果。

#### Scenario: 重连后重发
- **WHEN** WebSocket 断线重连成功，outbox 中存在未提交文件
- **THEN** 系统按启动扫描逻辑重发

### Requirement: Outbox 文件格式
Outbox 文件 SHALL 为 JSON 格式，包含提交所需的完整信息。

#### Scenario: 文件内容结构
- **WHEN** pipeline 结果写入 outbox
- **THEN** 文件内容为 `{ "teamName": "xxx", "taskId": "task-xxx", "from": "member1", "success": true, "data": {...}, "error": null, "trace": [...] }`
