## 1. 数据库 & 基础设施

- [x] 1.1 在 `manager-db.ts` 中新增 `ai_usage` 表的 CREATE TABLE 语句和索引（team、username、scene、created_at），更新 `createManagerDB()` 测试辅助函数
- [x] 1.2 在 `manager-db.ts` 中新增 `recordUsage(record: UsageRecord)` 函数，INSERT 到 `ai_usage`，内部 try/catch 静默错误不阻塞主流程
- [x] 1.3 在 `manager-db.ts` 中新增 `queryUsage(filters)` 函数，支持 from/to/team/username/scene 筛选和 team/username/scene/day 聚合
- [x] 1.4 为 `recordUsage` 和 `queryUsage` 编写单元测试（`tests/manager-db/ai-usage.test.ts`），覆盖写入、聚合、筛选、空结果场景

## 2. clientAuth 身份透传

- [x] 2.1 在 `routes/users.ts` 中新增 `lookupClientSession(token)` 函数，返回 `{ userId, role } | null`
- [x] 2.2 修改 `routes/middleware.ts` 的 `clientAuth`，调用 `lookupClientSession` 并 `c.set("userId", ...)` / `c.set("role", ...)`，保持 `validateClientToken` 不变确保向后兼容
- [x] 2.3 为 clientAuth 身份透传编写测试，验证 c.set 正确、无效 token 不透传

## 3. AI Handler 用量采集

- [x] 3.1 修改 `services/ai/agent.ts` — 提取 `result.usage`，读取 `c.req.header("team")` + `c.get("userId")` + resolved presetId，调用 `recordUsage`
- [x] 3.2 修改 `services/ai/chat.ts` `handleChatGenerate` — 同上模式采集 usage
- [x] 3.3 修改 `services/ai/chat.ts` `handleChatStream` — 在 `stream.ts` 发送 `done` 事件位置采集 usage，需传递 team/username/scene/presetId 上下文
- [x] 3.4 修改 `services/ai/chat.ts` `handleAutoReplyGenerate` — 采集 usage，username 使用请求体 `context.username`
- [x] 3.5 修改 `services/ai/task.ts` — 提取 `result.usage`（此前未提取），采集 usage，scene 为 "task"
- [x] 3.6 修改 `services/ai/dispatch.ts` — 提取 `result.usage`，采集 usage，scene 为 "dispatch"
- [x] 3.7 修改 `services/ai/review.ts` — 提取 `result.usage`，采集 usage，scene 为 "review"
- [x] 3.8 修改 `services/ai/analyze.ts` — 提取 `result.usage`，采集 usage，scene 为 "analyze"
- [x] 3.9 修改 `services/ai/cloudOrganize.ts`（若存在）— 提取 `result.usage`，采集 usage，scene 为 "cloud-organize"
- [x] 3.10 修改 `services/ai/index.ts` `createAIRoutes` — 传递 team/username 上下文到 chat/task/analyze handler

## 4. 用量查询 API

- [x] 4.1 在 `routes/ai.ts` 中新增 `GET /api/ai/usage` 端点（adminAuth），解析 from/to/team/username/scene/group 查询参数，调用 `queryUsage` 返回聚合结果
- [x] 4.2 为 usage API 编写测试：无认证 401、默认查询、按 team 聚合、按 username 聚合、按 scene 聚合、按 day 聚合、组合筛选

## 5. 前端 Dashboard 概览

- [x] 5.1 在 `web/src/api.ts` 新增 `getAIUsage(filters)` 方法，调用 `GET /api/ai/usage`
- [x] 5.2 修改 `Dashboard.vue` — 新增 AI 用量统计卡（今日 prompt tokens、completion tokens、调用次数），随 5 秒刷新

## 6. 前端 Analytics 独立页

- [x] 6.1 新增 `web/src/views/Analytics.vue` — 筛选栏（时间范围/团队/用户/场景）、统计总览卡、团队排行、用户排行、场景分布
- [x] 6.2 在 `web/src/router.ts` 注册 `/analytics` 路由
- [x] 6.3 在 `App.vue` 侧边栏导航新增 "AI 用量" 入口

## 7. 集成验证

- [x] 7.1 端到端验证：通过客户端触发 AI 调用 → 确认 `ai_usage` 表写入正确记录 → Dashboard 和 Analytics 页面显示正确数据
- [x] 7.2 全量测试通过：`cd manager/server && npm test` 无回归
