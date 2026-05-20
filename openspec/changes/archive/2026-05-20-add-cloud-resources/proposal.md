## Why

团队目前缺乏一个共享文件空间。现有资源系统是任务级的（`tasks/{id}/resources/`），产出物绑定在单个任务生命周期内，成员无法在任务之外共享文档、配置文件或数据集。需要一个团队级的云资源仓库，让所有成员可以浏览、上传和管理共享文件，同时与 Agent 执行系统集成，使 Agent 在执行任务时也能访问和上传团队共享资源。

## What Changes

- **新增团队云资源存储**：在 `~/.envoy/teams/{teamName}/cloud/` 下建立嵌套目录结构的文件仓库，实际文件落盘，元信息通过 SQLite `cloud_files` 表追踪（上传者、大小、时间）
- **新增 Manager API**：提供目录浏览、文件上传/下载、目录创建、文件/目录删除（仅 Leader）、使用统计等 REST 端点
- **客户端新增云资源面板**：侧边栏任务中心上方增加"云资源"入口，面板包含面包屑导航、嵌套目录浏览、文件上传、目录创建、删除操作（Leader 权限控制）
- **Agent 集成**：新增 `cloud_list` 和 `cloud_upload` 工具，Agent 执行任务时可访问和上传团队云资源
- **Manager 管理后台展示**：团队详情页增加云资源统计（文件总数、总大小、按用户使用分布）

## Capabilities

### New Capabilities

- `cloud-resources`: 团队级云资源管理，包含存储结构、API、权限模型、客户端 UI、Agent 工具和管理后台统计展示

### Modified Capabilities

- `member-react-agent`: 新增 cloud_list 和 cloud_upload Agent 工具，扩展 Agent 可用的工具集

## Impact

- **Manager 后端** (`manager/server/`): `db.ts` 新增 `cloud_files` 表 schema + CRUD 函数；新增 `routes/cloud.ts` 路由文件；`index.ts` 注册新路由
- **Manager 前端** (`manager/web/`): 团队详情页 (`TeamDetail.vue`) 增加云资源统计区块
- **客户端前端** (`src/`): `MemberSidebar.vue` 新增云资源入口；新增 `CloudResourcesPanel.vue` 组件；`ChatView.vue` 增加 `__cloud__` 面板切换；`api.ts` 新增云资源 API 封装
- **Agent 系统** (`src/agent/`): `tools.ts` 新增 cloud_list / cloud_upload 工具定义
- **数据存储**: 每个团队的 `team.db` 新增 `cloud_files` 表；`~/.envoy/teams/{teamName}/cloud/` 目录存储实际文件
