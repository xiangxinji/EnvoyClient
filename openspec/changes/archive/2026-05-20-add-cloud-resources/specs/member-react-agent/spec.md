## ADDED Requirements

### Requirement: Agent 云资源工具

Agent 工具集 SHALL 新增 `cloud_list` 和 `cloud_upload` 两个工具，使 Agent 在 ReAct 循环中可以访问和上传团队云资源。

#### Scenario: Agent 列出云资源目录

- **WHEN** Agent 在 ReAct 循环中调用 `cloud_list({ path: "documents/" })`
- **THEN** 工具 SHALL 调用 `GET /api/cloud/files?path=documents/`，将返回的文件和目录列表格式化为字符串返回给 Agent

#### Scenario: Agent 上传文件到云资源

- **WHEN** Agent 在 ReAct 循环中调用 `cloud_upload({ path: "output/", filename: "result.txt", content: "..." })`
- **THEN** 工具 SHALL 调用 `POST /api/cloud/files` 上传文件到指定路径，返回上传结果

#### Scenario: Agent 列出根目录

- **WHEN** Agent 调用 `cloud_list({ path: "" })` 或 `cloud_list({})`
- **THEN** 工具 SHALL 列出云资源根目录下的所有文件和目录
