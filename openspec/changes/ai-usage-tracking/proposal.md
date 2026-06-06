## Why

Manager 当前没有任何 AI 用量追踪机制。9 个 AI 端点的 token 消耗（prompt_tokens / completion_tokens）要么随 HTTP 响应丢弃，要么（generateObject 端点）甚至没被读取。管理员无法知道哪个团队、哪个用户、哪个场景消耗了多少 token，也无法评估成本或发现异常用量。需要建立全量采集、持久化存储和多维度展示的用量追踪体系。

## What Changes

- **clientAuth middleware 改造**：将 session 中的 `userId` 和 `role` 通过 `c.set()` 透传给下游 handler，替代当前只返回 boolean 的 `validateClientToken`
- **AI 端点增加团队上下文**：所有 clientAuth 保护的 AI 端点读取 `team` header 获取团队名称（与 messages 路由保持一致）
- **新建 ai_usage 数据库表**：在全局 manager-db 中持久化每次 AI 调用的 token 用量，维度包含 team、username、scene、preset_id
- **全量 usage 采集**：为全部 9 个 AI 端点（含 5 个目前丢弃 usage 的 generateObject 端点）增加 `result.usage` 提取和持久化逻辑
- **新增用量查询 API**：`GET /api/ai/usage` 支持按时间范围、团队、用户、场景筛选，返回聚合和明细数据
- **Dashboard 增加概览卡**：在现有统计卡旁增加今日/总 token 消耗统计
- **新增 /analytics 页面**：独立分析页，支持多维度筛选、团队/用户排行、场景分布、时间趋势

## Capabilities

### New Capabilities
- `ai-usage-tracking`: AI 调用 token 用量的采集、持久化、查询和展示，覆盖全部 9 个 AI 端点，按 team × username × scene × preset_id 维度记录

### Modified Capabilities
- `ai-service-integration`: AI 服务层需要提取 `result.usage` 并调用用量记录函数
- `manager-agent-endpoint`: Agent 端点需要读取 team/user 上下文并记录 usage

## Impact

- **后端**：`middleware.ts`（clientAuth 改造）、`services/ai/` 全部 9 个 handler 文件、`manager-db.ts`（新增表和 CRUD）、`routes/ai.ts`（新增查询端点）、`routes/users.ts`（暴露 session 查询函数）
- **前端**：`Dashboard.vue`（新增统计卡）、新增 `Analytics.vue` 页面、`router.ts`（新增路由）、`api.ts`（新增查询方法）、`App.vue`（侧边栏新增导航项）
- **数据库**：manager-db 新增 `ai_usage` 表
- **API**：新增 `GET /api/ai/usage` 端点
- **非破坏性**：clientAuth middleware 改造为向后兼容，不改变现有端点行为，仅新增上下文透传
