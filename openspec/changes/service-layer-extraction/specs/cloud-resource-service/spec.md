## ADDED Requirements

### Requirement: CloudResourceService.listFiles 列出云文件

CloudResourceService SHALL 提供 `listFiles(path?: string)` 方法。方法 SHALL 通过 `managerFetch` 向 `GET /api/cloud/files` 发送请求，可选 `path` query 参数，header 包含 `team: teamName`。

方法 SHALL 返回 `Promise<CloudDirListing>`。

#### Scenario: 列出根目录
- **WHEN** 调用 `listFiles()` 无参数
- **THEN** 请求 `GET /api/cloud/files`，返回根目录文件列表

#### Scenario: 列出子目录
- **WHEN** 调用 `listFiles("docs/reports/")`
- **THEN** 请求 `GET /api/cloud/files?path=docs%2Freports%2F`，返回该目录文件列表

### Requirement: CloudResourceService.uploadFile 上传文件到云

CloudResourceService SHALL 提供 `uploadFile(file: File, path: string, onProgress?: (pct: number) => void)` 方法。方法 SHALL 使用 `XMLHttpRequest` 发送 `POST /api/cloud/files`，header 包含 `team: teamName`，FormData 包含 `file`、`path`、`uploadedBy`（myId）。

方法 SHALL 返回 `Promise<CloudFileItem>`。

#### Scenario: 上传文件成功
- **WHEN** 调用 `uploadFile(file, "docs/", onProgress)`
- **THEN** XHR POST 到 /api/cloud/files，成功时返回 `CloudFileItem`

#### Scenario: 上传进度回调
- **WHEN** 上传过程中 XHR 触发 upload progress 事件
- **THEN** 调用 `onProgress` 回调，传入百分比（0-100 整数）

#### Scenario: 上传失败
- **WHEN** 服务端返回非 2xx
- **THEN** throw Error，包含错误信息

### Requirement: CloudResourceService.createDirectory 创建云目录

CloudResourceService SHALL 提供 `createDirectory(name: string, path: string)` 方法。方法 SHALL 通过 `managerPost` 向 `POST /api/cloud/directories` 发送请求，body 包含 `name`、`path`、`createdBy`（myId）。

方法 SHALL 返回 `Promise<CloudFileItem>`。

#### Scenario: 创建目录成功
- **WHEN** 调用 `createDirectory("reports", "docs/")`
- **THEN** POST body 为 `{ name: "reports", path: "docs/", createdBy: myId }`，返回新目录 `CloudFileItem`

### Requirement: CloudResourceService.deleteFile 删除云文件

CloudResourceService SHALL 提供 `deleteFile(filePath: string)` 方法。方法 SHALL 通过 `managerFetch` 向 `DELETE /api/cloud/files` 发送请求，query 包含 `path` 和 `from`（myId），header 包含 `team: teamName`。

方法 SHALL 返回 `Promise<void>`。

#### Scenario: 删除文件成功
- **WHEN** 调用 `deleteFile("docs/old-report.pdf")`
- **THEN** 请求 `DELETE /api/cloud/files?path=docs%2Fold-report.pdf&from=myId`

### Requirement: CloudResourceService.downloadUrl 获取下载链接

CloudResourceService SHALL 提供 `downloadUrl(filePath: string)` 方法。方法 SHALL 返回 `string`，通过 `apiUrl('/api/cloud/download/' + filePath)` 构造完整 URL。

此方法为纯函数，不发起 HTTP 请求。

#### Scenario: 构造下载 URL
- **WHEN** 调用 `downloadUrl("docs/report.pdf")`
- **THEN** 返回 `"http://localhost:8080/api/cloud/download/docs/report.pdf"`

### Requirement: CloudResourceService.search 搜索云文件

CloudResourceService SHALL 提供 `search(query: string)` 方法。方法 SHALL 通过 `managerFetch` 向 `GET /api/cloud/search` 发送请求，query 包含 `q` 参数，header 包含 `team: teamName`。

方法 SHALL 返回 `Promise<CloudSearchResult[]>`。

#### Scenario: 搜索文件
- **WHEN** 调用 `search("report")`
- **THEN** 请求 `GET /api/cloud/search?q=report`，返回匹配文件列表

### Requirement: CloudResourceService.validatePaths 验证云路径

CloudResourceService SHALL 提供 `validatePaths(paths: readonly string[])` 方法。方法 SHALL 通过 `managerPost` 向 `POST /api/cloud/validate` 发送请求，body 包含 `{ paths }`。

方法 SHALL 返回 `Promise<Record<string, boolean>>`。当 `paths` 为空数组时 SHALL 直接返回 `{}`，不发起请求。

#### Scenario: 验证路径存在性
- **WHEN** 调用 `validatePaths(["docs/a.pdf", "docs/b.pdf"])`
- **THEN** POST `{ paths: ["docs/a.pdf", "docs/b.pdf"] }`，返回 `{ "docs/a.pdf": true, "docs/b.pdf": false }`

#### Scenario: 空数组快速返回
- **WHEN** 调用 `validatePaths([])`
- **THEN** 直接返回 `{}`，不发起 HTTP 请求

### Requirement: CloudResourceService.getStats 获取云存储统计

CloudResourceService SHALL 提供 `getStats()` 方法。方法 SHALL 通过 `managerFetch` 向 `GET /api/cloud/stats` 发送请求，header 包含 `team: teamName`。

方法 SHALL 返回 `Promise<CloudStats>`。

#### Scenario: 获取统计信息
- **WHEN** 调用 `getStats()`
- **THEN** 返回 `{ totalFiles, totalSize, totalDirs, byUser: [...] }`
