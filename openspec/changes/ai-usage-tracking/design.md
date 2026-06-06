## Context

Manager 有 9 个 AI 端点，分布在 `services/ai/` 的 7 个文件中。调用链路为：

```
HTTP Request → clientAuth middleware → resolveForScene(sceneType) → resolveModel() → generateText/streamText/generateObject
```

当前状态：
- `clientAuth` middleware (`routes/middleware.ts`) 调用 `validateClientToken(token)` 只返回 `boolean`，session 中的 `{ userId, role }` 数据在内存中但未暴露
- AI handler 不读取 `team` header（messages 路由已在使用 `team` header）
- `generateText` / `streamText` 的 4 个端点已提取 `result.usage` 返回给调用方，但未持久化
- `generateObject` 的 5 个端点完全丢弃 `result.usage`，代码中未读取
- 全局 manager-db (`manager-db.ts`) 中无任何 usage 相关表

数据库为 SQLite（全局 manager-db + 每团队独立 db），AI 配置已存储在全局 manager-db 的 `ai_presets` 和 `ai_scenes` 表中。

## Goals / Non-Goals

**Goals:**
- 全量采集 9 个 AI 端点的 prompt_tokens + completion_tokens
- 按 team × username × scene × preset_id 四维归档每次调用
- 改造 clientAuth 透传用户身份，AI 端点读取 team header
- Dashboard 展示今日/总 token 概览
- 独立 /analytics 页面支持多维度筛选、排行、趋势展示
- 0 破坏性变更，现有端点行为不变

**Non-Goals:**
- 不换算实际金额（不维护价格表）
- 不做 token 限速 / 配额管控
- 不在客户端 UI（EnvoyClient 主应用）展示用量，仅 Manager 管理后台
- 不追踪 per-request 的详细 latency 或错误率（这是监控不是计费）

## Decisions

### D1: 用量存储位置 — 全局 manager-db

**选择**: 在全局 manager-db 中新建 `ai_usage` 表。

**理由**: 用量分析需要跨团队聚合查询，放在全局 db 比每团队 db 更合适。全局 db 已有 `ai_presets`、`ai_scenes` 表，usage 数据与 preset 关联查询方便。

**替代方案**: 每团队 db 各建一张 — 跨团队聚合需要遍历所有 db，复杂且慢。不选。

### D2: clientAuth 改造方式 — 新增 lookup 函数 + c.set()

**选择**: 在 `routes/users.ts` 新增 `lookupClientSession(token)` 函数返回 `{ userId, role } | null`，`clientAuth` middleware 调用它并通过 `c.set("userId", ...)` / `c.set("role", ...)` 透传。

**理由**: 最小改动。`validateClientToken` 保持不变（保持向后兼容），新增 lookup 函数供需要身份信息的中间件使用。`c.set()` 是 Hono 标准 context 传递方式。

**替代方案**: 改 `validateClientToken` 返回 session 对象 — 影响所有调用方，需要改返回类型。改动面大且不必要。

### D3: team 上下文来源 — 复用 `team` header

**选择**: AI 端点通过 `c.req.header("team")` 获取团队名，与 messages 路由一致。

**理由**: 客户端已经在所有 client-authenticated 请求中发送 `team` header（messages、cloud、brains 端点均使用），无需客户端新增任何 header。

### D4: usage 采集方式 — 统一 recordUsage 工具函数

**选择**: 在 `manager-db.ts` 中新增 `recordUsage(params)` 函数，所有 AI handler 在调用完成后统一调用。

```typescript
// manager-db.ts
interface UsageRecord {
  team: string;
  username: string;
  scene: string;       // "chat" | "agent" | "task" | "dispatch" | "review" | "analyze" | "auto-reply" | "cloud-organize"
  presetId: string;
  promptTokens: number;
  completionTokens: number;
}

function recordUsage(record: UsageRecord): void
```

**理由**: 单一写入点，确保格式统一，便于后续扩展（如加字段只需改一处）。

### D5: ai_usage 表设计

```sql
CREATE TABLE IF NOT EXISTS ai_usage (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  team             TEXT NOT NULL,
  username         TEXT NOT NULL,
  scene            TEXT NOT NULL,
  preset_id        TEXT NOT NULL,
  prompt_tokens    INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL
);

CREATE INDEX idx_ai_usage_team ON ai_usage(team);
CREATE INDEX idx_ai_usage_username ON ai_usage(username);
CREATE INDEX idx_ai_usage_scene ON ai_usage(scene);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at);
```

**理由**: 无需关联用户表（username 直接存储），查询维度全覆盖，created_at 索引支持时间范围筛选。

### D6: Analytics API 设计

```
GET /api/ai/usage?from=<ts>&to=<ts>&team=<name>&username=<name>&scene=<type>&group=<team|username|scene|day>
```

**响应格式**:
```typescript
{
  total: { promptTokens: number; completionTokens: number; calls: number };
  breakdown: Array<{
    key: string;  // groupBy 维度的值
    promptTokens: number;
    completionTokens: number;
    calls: number;
  }>;
}
```

**理由**: 单一端点通过 `group` 参数聚合不同维度，前端 Dashboard 和 Analytics 页复用同一 API。

### D7: 前端架构

- **Dashboard.vue**: 新增第 4 张统计卡，调用 `GET /api/ai/usage?from=<今日0点>&group=day` 获取今日用量
- **Analytics.vue**: 新增独立页面，包含：
  - 筛选栏：时间范围（今日/7天/30天/自定义）、团队下拉、用户下拉、场景下拉
  - 统计卡：总 prompt / completion / 调用次数
  - 团队排行、用户排行、场景分布（三列卡片）
  - 时间趋势（简易柱状图，按天聚合）
- **路由**: `/analytics` 新增到 `router.ts`
- **侧边栏**: `App.vue` 的导航列表新增 "AI 用量" 入口

### D8: streamText 的 usage 采集时机

**选择**: 在 `stream.ts` 的 SSE 流结束时（发送 `done` 事件的位置）调用 `recordUsage`。

**理由**: `streamText` 的 `result.usage` 只在流完成后可用。`stream.ts` 已经在这个位置提取并发送 usage，改为同时持久化。

**挑战**: stream handler 需要接收 team/username/scene/presetId 参数 — 通过修改 `createAIRoutes` 和 `handleChatStream` 函数签名传入。

## Risks / Trade-offs

**[高频写入]** → ai_usage 表随 AI 调用频率增长。缓解：SQLite 单条 INSERT 性能足够（万级 QPS 内无问题）。长期可考虑定期归档或限制保留天数。

**[clientAuth 改造影响范围]** → 所有使用 clientAuth 的端点都会获得 c.set 上下文。缓解：向后兼容，不读取 c.get("userId") 的代码不受影响。纯增量。

**[stream 场景的上下文传递]** → `handleChatStream` 和 `handleChatGenerate` 在 `services/ai/index.ts` 的 `createAIRoutes` 工厂中注册，上下文需要从 route handler 传入 service 层。缓解：修改函数签名增加 context 参数，改动局限在 `index.ts` 和 `chat.ts`。

**[auto-reply 的 username 归属]** → auto-reply 由系统触发，username 应记录触发者（开了 auto-reply 的用户）。缓解：auto-reply 端点的请求体已包含 `context.username`，直接使用。
