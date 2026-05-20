## Context

当前客户端操作散落在三个层面：
- `api.ts` 包含 cloud/profile REST 函数（纯 HTTP 调用）
- composable 层（`useMessages`、`useTaskActions`、`useFileUpload` 等）包含业务逻辑 + 直接 `managerPost` 调用
- `.vue` 组件（`CloudResourcesPanel`）直接 import `api.ts` 函数

没有统一的操作入口，未来 AI Agent 无法通过标准化的 tool 接口操控 UI。

## Goals / Non-Goals

**Goals:**
- 建立纯 TypeScript Service 层，作为所有 UI 发送操作的唯一入口
- 每个 Service 方法保证参数不可变（readonly）和操作原子性
- Service 可独立于 Vue 进行单元测试
- 为后续 AI Agent + tool 调用提供标准化接口

**Non-Goals:**
- 不改变 WebSocket 事件接收逻辑（仍在 composable 层）
- 不改变后端 API 端点或协议
- 不在本阶段对接 Agent tool（后续变更）
- 不改变 Vue 组件的响应式状态管理模式

## Decisions

### D1: Service 使用 class + 工厂函数注入配置

**选择**: Class 实例化，构造器接收 `getConfig()` 回调

```ts
export class MessageService {
  constructor(
    private readonly getConfig: () => Readonly<ServiceConfig>
  ) {}
}
```

**替代方案**:
- 纯函数集合 + 闭包 → 也可以，但 class 更方便类型标注和依赖注入
- 模块单例 → 生命周期管理困难，测试需 mock 模块

**理由**: `getConfig()` 回调让 service 不关心连接状态，每次方法调用时取最新 config。连接前返回空值 → 请求自然失败。class 实例可通过 `teamClientContext.ts` 全局持有，也可单独 new 用于测试。

### D2: Config 类型定义

```ts
interface ServiceConfig {
  readonly myId: string;
  readonly teamName: string;
}
```

所有 Service 共享同一个 config 接口。配置来源为 `teamClientContext` 的 `_instance`。

### D3: 实例生命周期 — 独立于 composable

Service 实例在 `teamClientContext.ts` 中创建，不依赖 `useTeamClient` 的调用时机：

```ts
// teamClientContext.ts
const messageService = new MessageService(() => ({
  myId: _instance.value?.myId ?? "",
  teamName: _instance.value?.teamName ?? "",
}));
```

**理由**: Agent tool 未来需要直接访问 service，不应依赖 Vue composable 生命周期。

### D4: 方法签名 — 不可变 + 原子

原则：
- 所有参数用 `readonly` 或具体字面量类型（不接受 `any`）
- 每个 method = 一个完整操作（不暴露半成品）
- 返回值类型明确，throw 错误

```ts
// 好：原子操作，参数不可变
async send(targetId: string, text: string, options?: Readonly<SendOptions>): Promise<SendResult>

// 差：暴露内部实现
async rawPost(path: string, body: unknown): Promise<Response>
```

### D5: api.ts 保留范围

迁移后 `api.ts` 只保留 HTTP 基础设施：
- `setManagerUrl` / `setClientToken` / `getClientToken`
- `apiUrl` / `managerFetch` / `managerPost`

移除：
- Cloud 全部函数 → `CloudResourceService`
- Profile 全部函数 → `UserProfileService`
- `CloudFileItem` / `CloudDirListing` / `CloudStats` / `CloudSearchResult` 类型 → `src/services/types.ts`
- `UserProfile` 类型 → `src/services/types.ts`

### D6: 文件结构

```
src/services/
├── types.ts              # 共享类型定义
├── MessageService.ts     # 消息操作
├── CloudResourceService.ts
├── TaskService.ts
└── UserProfileService.ts
```

### D7: 各 Service 方法清单

**MessageService**

| 方法 | HTTP | 来源 |
|---|---|---|
| `send(targetId, text, options?)` | POST /api/messages | useMessages.sendChat |
| `revoke(msgId)` | DELETE /api/messages/:id | useMessages.revokeMessage |
| `uploadAttachment(file)` | POST /api/messages/attachments | useFileUpload |

**CloudResourceService**

| 方法 | HTTP | 来源 |
|---|---|---|
| `listFiles(path?)` | GET /api/cloud/files | api.ts listCloudFiles |
| `uploadFile(file, path, onProgress?)` | POST /api/cloud/files (XHR) | api.ts uploadCloudFile |
| `createDirectory(name, path)` | POST /api/cloud/directories | api.ts createCloudDirectory |
| `deleteFile(filePath)` | DELETE /api/cloud/files | api.ts deleteCloudFile |
| `downloadUrl(filePath)` | URL builder | api.ts cloudDownloadUrl |
| `search(query)` | GET /api/cloud/search | api.ts searchCloudFiles |
| `validatePaths(paths)` | POST /api/cloud/validate | api.ts validateCloudPaths |
| `getStats()` | GET /api/cloud/stats | api.ts getCloudStats |

**TaskService**

| 方法 | HTTP | 来源 |
|---|---|---|
| `dispatch(targetIds, content)` | POST /api/tasks | useTeamClient.dispatchTask |
| `start(taskId)` | POST /api/tasks/:id/start | useTaskActions / useTaskExecution |
| `complete(taskId, data)` | POST /api/tasks/:id/complete | useTaskActions.doComplete |
| `submitResult(taskId, result)` | POST /api/tasks/:id/result | useTaskActions / useTaskExecution |
| `uploadResource(taskId, file)` | POST /api/tasks/:id/resources | useTaskActions.handleUpload |
| `fetchDetail(taskId)` | GET /api/teams/:team/tasks/:id | useTaskLiveData |
| `downloadResourceUrl(taskId, filename)` | URL builder | taskFormatters.getTaskFileUrl |

**UserProfileService**

| 方法 | HTTP | 来源 |
|---|---|---|
| `fetchProfiles(usernames)` | GET /api/users/profiles | api.ts fetchProfiles |
| `updateProfile(username, data)` | PATCH /api/users/:username/profile | api.ts updateProfile |
| `uploadAvatar(username, file)` | POST /api/users/:username/avatar | api.ts uploadAvatar |

### D8: Composable 迁移策略

逐个 composable 改造，每个 composable 的改造是独立可合并的：

1. 创建所有 Service class（无调用方改动）
2. `teamClientContext.ts` 中实例化并导出
3. 逐个 composable 切换到 service 调用
4. 清理 `api.ts` 中已迁移的函数
5. 清理 `.vue` 中对 `api.ts` 的直接 import

## Risks / Trade-offs

**[双重调用风险]** → 迁移期间 composable 可能同时保留旧调用和新的 service 调用。通过逐个文件迁移 + 删除旧代码来避免。

**[getConfig 空值]** → 连接前 getConfig 返回空字符串，请求会失败但不会崩溃。这是预期行为，因为连接前 UI 不应触发操作。

**[CloudResourcesPanel 直接 import]** → 需要创建 `useCloudFiles` composable 或直接注入 service。后者更简单，因为该组件已有业务逻辑，创建 composable 包裹更干净。

## Open Questions

- `useTaskExecution` 中的 `postToManager` 内联函数有 5 处调用，迁移后是否需要额外封装（如 `TaskExecutionService`）还是直接用 `TaskService`？当前倾向直接用 `TaskService`。
