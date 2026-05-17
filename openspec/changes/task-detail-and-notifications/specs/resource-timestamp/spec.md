## ADDED Requirements

### Requirement: Resource timestamp field
Envoy core 的 Resource 接口 SHALL 包含一个可选的 `timestamp` 字段（`number | undefined`），记录资源被添加到 Task 的时间。

#### Scenario: Server 自动填充 timestamp
- **WHEN** Server 调用 `addResource()` 为 Task 添加新 Resource
- **THEN** Resource 的 `timestamp` 字段 SHALL 被自动设置为 `Date.now()`

#### Scenario: 旧数据兼容
- **WHEN** 加载不包含 timestamp 的旧 Resource 数据
- **THEN** `timestamp` 字段 SHALL 为 `undefined`，前端 SHALL 不显示该资源的时间信息

### Requirement: Client TaskResource 同步 timestamp
Client 的 `TaskResource` 类型 SHALL 包含可选的 `timestamp` 字段，与 Envoy core Resource 保持一致。

#### Scenario: 接收带 timestamp 的任务更新
- **WHEN** 客户端收到包含 Resource timestamp 的任务更新
- **THEN** TaskResource.timestamp SHALL 被正确传递和显示

#### Scenario: 接收不带 timestamp 的任务更新
- **WHEN** 客户端收到不包含 Resource timestamp 的旧格式任务更新
- **THEN** 系统 SHALL 正常处理，timestamp 默认为 undefined
