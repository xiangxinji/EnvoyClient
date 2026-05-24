## Context

客户端知识库存储在 `~/.envoy/brains/{username}/`，目前仅由 Agent 通过 `read_skill` 工具在任务执行时读取。知识库文件与云资源系统完全隔离——Agent 只读本地文件，云盘是纯手动操作。

现有基础设施：
- `CloudResourceService` 提供 `listFiles`、`uploadFile`、`deleteFile` 等方法，但**不应复用于 brains 同步**（权限不同、语义不同、会污染云盘浏览）
- Manager 后端使用 Hono 框架，路由模式为独立函数接收 `app + teamInstances`，存储在 `~/.envoy/teams/{team}/` 下
- `useMemberSettings` 单例管理用户设置，通过 Tauri `get_settings`/`save_settings` 持久化
- `useTeamClient` 的 `conn.client.on("task", ...)` 监听任务状态变更事件
- Tauri 端 `brains.rs` 已有 `init_brains` 命令，`lib.rs` 已有 `load_skill_catalog` 命令
- `teamClientContext.ts` 提供全局单例访问所有 service 和 composable

## Goals / Non-Goals

**Goals:**
- 提供增量同步机制，仅上传变更文件，节省带宽
- 支持两种触发方式（固定间隔、任务完成后），用户可多选
- 在设置面板和侧边栏提供同步进度可见性
- 提供手动恢复操作，从云端下载覆盖本地
- 仅在已登录状态下执行同步

**Non-Goals:**
- 不实现冲突合并策略（恢复为全量覆盖语义）
- 不同步 Agent 工作区（`workspace/`），仅同步 brains 目录

## Decisions

### D1: 增量同步基于本地 manifest 文件

**选择**: 在 `~/.envoy/brains/{username}/.sync_manifest.json` 存储每个文件的 hash 和上次同步时间

**理由**: 比对云端文件列表需要额外 API 调用，且云端文件元数据可能不包含内容 hash。本地 manifest 可以直接在扫描时生成 hash 并比对，零网络开销判断变更。

**备选方案**:
- 比对云端文件列表：需要额外 API 调用，且无法区分内容是否变更（只能看文件名是否存在）
- 仅用 mtime 比对：mtime 可能被文件拷贝等操作修改，不够可靠

### D2: 同步 composable 注册在 teamClientContext

**选择**: `useBrainsSync` 在 `teamClientContext.ts` 中创建单例，和 `useMemberSettings`、`CloudResourceService` 同级

**理由**: 同步是全局行为（不绑定到特定组件），需要在 `useTeamClient` 连接建立后注册触发器，在连接断开时清理。单例模式确保只有一个同步实例运行。

### D3: Manager 端新增专用 brains sync API

**选择**: 在 Manager 后端新增 `routes/brains.ts`，提供 4 个专用 API endpoint，独立于 cloud 资源系统。

**API 设计**:
| Endpoint | Method | 用途 |
|---|---|---|
| `/api/brains/sync` | POST | 批量同步：接收 `{ username, files: [{ path, content }] }`，upsert 语义（已有则覆盖） |
| `/api/brains/files` | GET | 列出指定用户的所有备份文件（`?username=xxx`），排除 `.backup.*` |
| `/api/brains/download/*` | GET | 下载指定备份文件 |
| `/api/brains/rename` | POST | 改名：`{ username, path, newPath }`，用于本地删除后云端改名 |

**存储路径**: `~/.envoy/teams/{team}/brains/{username}/`（与 `cloud/` 目录隔离）

**理由**:
- cloud API 的文件上传有 `409 Conflict` 检查（同名拒绝），sync 需要 upsert 语义
- cloud 的删除需要 leader 权限，sync 不应受此限制
- brains 备份不应出现在用户的云盘浏览器中
- 批量 sync 减少网络请求次数（一个请求上传多个文件）
- 改名操作由服务端原子完成，而非客户端的"下载+重传+删除"三步 hack

### D4: 删除文件处理为云端改名

**选择**: 本地已删除的文件，在云端重命名为 `.backup.ext`（如 `code-review.md` → `code-review.backup.md`）

**理由**: 备份语义——云是安全网，不跟着本地删除。`.backup` 后缀让用户和系统都能区分活跃文件和历史备份。恢复时跳过 `.backup.*` 文件。

**备选方案**:
- 直接删除云端文件：违背备份目的
- 移动到 `backups/brains/{user}/.deleted/` 子目录：需要额外的目录管理逻辑，增加复杂度

### D5: 进度追踪粒度为文件级别

**选择**: 显示 "正在同步 3/12 个文件..." 而非字节级进度

**理由**: `.md` 文件通常很小（几 KB），单文件上传耗时极短。文件级进度对用户更有意义，且实现简单（不需要监听每个上传请求的 XHR progress）。

### D6: "任务完成后" 触发器过滤条件

**选择**: 仅当 `task.subscribe.includes(myId)` 且 `task.status === "completed"` 时触发

**理由**: `subscribe` 数组包含被分配执行任务的成员。只有自己是任务执行者时，才可能在执行过程中修改了知识库文件。Leader 创建但未亲自执行的任务不应触发同步。

## Risks / Trade-offs

- **[首次同步耗时]** → 首次开启同步时，所有文件视为新增全量上传。如果文件数量很多（100+），首次同步可能需要数十秒。缓解：进度条展示文件级进度，后台执行不阻塞 UI。
- **[并发同步]** → 定时器和任务完成可能同时触发同步。缓解：`doSync()` 使用 `syncing` 锁，如果已在同步中则跳过本次触发。
- **[manifest 损坏]** → manifest 文件损坏或格式错误。缓解：catch 解析错误，视为空 manifest 触发全量同步。
- **[网络中断]** → 同步中途网络断开，部分文件已上传。缓解：manifest 仅在所有文件处理完成后更新，下次同步会重新上传中断的文件（幂等）。
- **[恢复操作覆盖]** → 用户点击恢复会完全覆盖本地文件，不可逆。缓解：使用 `useConfirm` 确认对话框（danger 模式），明确告知后果。
