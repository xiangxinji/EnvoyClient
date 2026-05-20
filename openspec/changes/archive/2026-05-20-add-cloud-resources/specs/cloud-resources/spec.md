## ADDED Requirements

### Requirement: 团队云资源存储结构

系统 SHALL 在 `~/.envoy/teams/{teamName}/cloud/` 下存储团队云资源文件。文件以真实的嵌套目录结构落盘。每个团队的 `team.db` 数据库 SHALL 包含 `cloud_files` 表用于追踪文件和目录元信息：

```
cloud_files (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  path        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'file',   -- 'file' | 'directory'
  size        INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
)
```

`path` 字段 SHALL 存储相对于 cloud 根目录的路径（如 `documents/specs/`），`name` 存储最终文件名或目录名。

#### Scenario: 新团队首次使用云资源

- **WHEN** 成员首次向团队上传文件或创建目录
- **THEN** 系统 SHALL 自动创建 `~/.envoy/teams/{teamName}/cloud/` 目录，并在 `cloud_files` 表中插入对应记录

#### Scenario: 数据库表初始化

- **WHEN** 团队的 `team.db` 被初始化（`initTeamDatabase`）
- **THEN** `cloud_files` 表 SHALL 与 messages、tasks 表一同被创建，包含 `idx_cloud_path` 和 `idx_cloud_parent` 索引

### Requirement: 目录浏览 API

`GET /api/cloud/files` 端点 SHALL 返回指定路径下的直接子项列表（单层级）。请求通过 `team` header 指定团队，`path` query 参数指定浏览路径（默认为根目录 `/`）。

返回格式 SHALL 为：
```json
{
  "path": "documents/specs/",
  "items": [
    { "id": "...", "name": "spec.pdf", "type": "file", "size": 2048, "uploadedBy": "alice", "createdAt": 1715800000000 },
    { "name": "drafts/", "type": "directory", "uploadedBy": "bob", "createdAt": 1715801000000 }
  ]
}
```

#### Scenario: 浏览根目录

- **WHEN** 客户端 GET `/api/cloud/files`（无 path 参数）
- **THEN** 返回 cloud 根目录下的所有直接子项

#### Scenario: 浏览子目录

- **WHEN** 客户端 GET `/api/cloud/files?path=documents/specs/`
- **THEN** 返回 `documents/specs/` 目录下的所有直接子项

#### Scenario: 浏览不存在的路径

- **WHEN** 客户端 GET `/api/cloud/files?path=nonexistent/`
- **THEN** 系统 SHALL 返回空 items 数组

### Requirement: 文件上传 API

`POST /api/cloud/files` 端点 SHALL 接受 multipart/form-data 上传文件。请求 SHALL 包含 `file`（文件）、`path`（目标目录路径，可选，默认根目录）和 `uploadedBy`（上传者用户名）。

#### Scenario: 上传文件到根目录

- **WHEN** 成员 POST 文件 `report.pdf` 到 `/api/cloud/files`，body 包含 `{ file, uploadedBy: "alice" }`
- **THEN** 系统 SHALL 将文件写入 `cloud/report.pdf`，在 `cloud_files` 表插入记录，返回 `{ ok: true, item: { id, name, size, uploadedBy, createdAt } }`

#### Scenario: 上传文件到子目录

- **WHEN** 成员 POST 文件 `spec.pdf` 到 `/api/cloud/files`，body 包含 `{ file, path: "documents/", uploadedBy: "alice" }`
- **THEN** 系统 SHALL 将文件写入 `cloud/documents/spec.pdf`，在 DB 中记录 `path: "documents/"`, `name: "spec.pdf"`

#### Scenario: 上传同名文件

- **WHEN** 成员上传文件到路径下已存在同名文件的目录
- **THEN** 系统 SHALL 返回 409 错误 `{ error: "file already exists" }`，不覆盖原文件

#### Scenario: 上传到不存在的子目录

- **WHEN** 成员上传文件到尚未创建的目录路径
- **THEN** 系统 SHALL 自动创建所需的中间目录，然后写入文件

### Requirement: 文件下载 API

`GET /api/cloud/download/*path` 端点 SHALL 返回指定文件的二进制内容，带 `Content-Disposition: attachment` header。

#### Scenario: 下载存在的文件

- **WHEN** 客户端 GET `/api/cloud/download/documents/spec.pdf`
- **THEN** 返回文件二进制内容，Content-Type 根据 extension 推断

#### Scenario: 下载不存在的文件

- **WHEN** 客户端 GET `/api/cloud/download/nonexistent.txt`
- **THEN** 返回 404 错误

### Requirement: 创建目录 API

`POST /api/cloud/directories` 端点 SHALL 接受 `{ name, path?, createdBy }` body 创建新目录。

#### Scenario: 在根目录创建新目录

- **WHEN** 成员 POST `{ name: "documents", createdBy: "alice" }`
- **THEN** 系统 SHALL 在磁盘创建 `cloud/documents/` 目录，在 DB 插入 `{ type: "directory", path: "", name: "documents" }` 记录

#### Scenario: 在子目录下创建嵌套目录

- **WHEN** 成员 POST `{ name: "specs", path: "documents/", createdBy: "alice" }`
- **THEN** 系统 SHALL 在磁盘创建 `cloud/documents/specs/` 目录，DB 记录 `path: "documents/"`, `name: "specs"`

#### Scenario: 创建已存在的目录

- **WHEN** 成员尝试创建已存在的同名目录
- **THEN** 系统 SHALL 返回 409 错误

### Requirement: 删除文件/目录 API

`DELETE /api/cloud/files` 端点 SHALL 仅允许 Leader 角色删除文件或目录。请求通过 `?path=` 指定要删除的路径，通过 `team` header 和请求者身份验证角色。

#### Scenario: Leader 删除文件

- **WHEN** Leader DELETE `/api/cloud/files?path=documents/old.pdf`
- **THEN** 系统 SHALL 删除磁盘文件，删除 DB 中对应记录，返回 `{ ok: true }`

#### Scenario: Leader 删除目录（级联）

- **WHEN** Leader DELETE `/api/cloud/files?path=documents/`
- **THEN** 系统 SHALL 递归删除磁盘上 `cloud/documents/` 目录及所有子文件和子目录，删除 DB 中所有 `path` 以 `documents/` 为前缀的记录

#### Scenario: Member 尝试删除

- **WHEN** Member 角色 DELETE `/api/cloud/files?path=file.txt`
- **THEN** 系统 SHALL 返回 403 错误 `{ error: "only leader can delete" }`

#### Scenario: 删除不存在的文件

- **WHEN** Leader DELETE `/api/cloud/files?path=nonexistent.txt`
- **THEN** 系统 SHALL 返回 404 错误

### Requirement: 云资源统计 API

`GET /api/cloud/stats` 端点 SHALL 返回团队云资源的使用统计。

#### Scenario: 获取统计信息

- **WHEN** 客户端 GET `/api/cloud/stats`
- **THEN** 返回 `{ totalFiles: number, totalSize: number, totalDirs: number, byUser: [{ user: string, fileCount: number, totalSize: number }] }`

### Requirement: 路径安全验证

所有接受用户输入路径的云资源端点 SHALL 对路径参数进行安全验证：经过 `path.resolve` + `path.normalize` 处理后，验证结果路径以 cloud 根目录为前缀，防止路径遍历攻击。

#### Scenario: 路径遍历攻击被拦截

- **WHEN** 请求包含 `path=../../etc/passwd`
- **THEN** 系统 SHALL 返回 400 错误，不执行任何文件操作

#### Scenario: 正常路径通过验证

- **WHEN** 请求包含 `path=documents/specs/`
- **THEN** 路径 SHALL 正常处理，解析为 `cloud/documents/specs/`

### Requirement: 客户端侧边栏云资源入口

MemberSidebar 组件 SHALL 在任务中心入口上方增加"云资源"导航项，选中时 emit `__cloud__` 标识。

#### Scenario: 点击云资源入口

- **WHEN** 用户点击侧边栏"云资源"
- **THEN** `selectedPeer` SHALL 变为 `__cloud__`，主内容区显示 CloudResourcesPanel

### Requirement: CloudResourcesPanel 面板

系统 SHALL 提供 CloudResourcesPanel 组件，包含面包屑导航、文件/目录列表、上传和创建目录操作。

#### Scenario: 面板初始加载

- **WHEN** 用户选择云资源面板
- **THEN** 面板 SHALL 自动加载根目录文件列表，显示面包屑 `/`

#### Scenario: 进入子目录

- **WHEN** 用户点击目录项 `documents/`
- **THEN** 面板 SHALL 加载 `documents/` 下的内容，面包屑更新为 `/ > documents`

#### Scenario: 面包屑导航回上级

- **WHEN** 用户点击面包屑中的 `documents`
- **THEN** 面板 SHALL 加载 `documents/` 的内容，更新面包屑

#### Scenario: 上传文件

- **WHEN** 用户点击"上传文件"按钮并选择文件
- **THEN** 系统 SHALL 调用上传 API，成功后刷新当前目录列表

#### Scenario: 创建目录

- **WHEN** 用户点击"新建目录"按钮并输入名称
- **THEN** 系统 SHALL 调用创建目录 API，成功后刷新当前目录列表

#### Scenario: Leader 删除操作

- **WHEN** Leader 角色的用户在文件/目录上点击删除
- **THEN** 系统 SHALL 弹出二次确认，确认后调用删除 API，成功后刷新目录列表

#### Scenario: Member 看不到删除按钮

- **WHEN** Member 角色的用户浏览云资源
- **THEN** 文件和目录上 SHALL NOT 显示删除按钮

#### Scenario: 下载文件

- **WHEN** 用户点击文件项的下载按钮
- **THEN** 系统 SHALL 调用下载 API，通过 Tauri 原生保存对话框保存文件

### Requirement: Manager 管理后台云资源统计

团队详情页 SHALL 展示该团队的云资源使用统计，包含文件总数、总大小和按用户的使用分布。

#### Scenario: 查看团队云资源统计

- **WHEN** 管理员在 Manager 后台打开团队详情页
- **THEN** 页面 SHALL 显示云资源统计卡片：文件总数、总大小（格式化为 KB/MB/GB）、按用户的使用分布列表
