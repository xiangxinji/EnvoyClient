## Context

ai-layer 是一个独立包，包含 server（Hono 路由）、client（HTTP/SSE 封装）、shared（类型和常量）三个模块。实际使用中，只有 server 部分被 manager 通过 `createAIRoutes()` 消费，client 模块完全无人使用（前端 useAI.ts 自行实现了 HTTP 调用和 SSE 解析），shared 模块仅因 server 的依赖而存在。

当前 import 路径：`manager/server/routes/ai.ts` → `../../../ai-layer/src/server`，跨多层目录引用。

## Goals / Non-Goals

**Goals:**
- 消除 ai-layer 独立包，将 AI 逻辑内联到 manager
- 删除无人使用的 client 模块
- 建立清晰的代码组织：共享类型在 `shared/types/`，服务逻辑在 `manager/server/services/ai/`
- 所有 AI API 行为保持不变

**Non-Goals:**
- 不改变 AI API 的请求/响应格式
- 不重写 useAI.ts（继续使用现有 fetch 方式）
- 不引入新的构建步骤或工具链

## Decisions

### 1. shared 类型的位置：项目根 shared/types/

**选择**: `shared/types/ai.ts`（类型定义）+ `shared/types/sse.ts`（SSE 类型）

**替代方案**: 放在 `manager/server/` 内部

**理由**: 类型定义（AIConfig、ChatRequest、SSEEvent 等）理论上前后端都需要。虽然当前前端 useAI.ts 自行定义了内联类型，但将共享类型放在项目根目录为未来前端直接引用留有余地。

### 2. server 代码的位置：manager/server/services/ai/

**选择**: `manager/server/services/ai/` 作为服务层目录

**替代方案**: 直接放在 `manager/server/routes/` 下

**理由**: AI 逻辑包含多个文件（chat、task、analyze、provider、stream、prompts），不适合和路由文件混在一起。services/ 目录将业务逻辑与路由定义分离，路由文件只负责 HTTP 层。

### 3. constants 和 prompts 随 server 走

**选择**: constants.ts 和 prompts/ 目录放入 `manager/server/services/ai/`

**理由**: PROVIDERS 常量和 prompt 模板只在服务端使用，不属于共享类型。

### 4. 直接删除 ai-layer 目录

**选择**: 完成迁移后删除整个 `ai-layer/`

**理由**: 没有其他消费者，无需保留。Git 历史可以追溯。

## Risks / Trade-offs

- **[Import 路径变更范围]** 涉及 ~15 个文件的 import 修改 → 逐文件修改，每个文件验证路径正确性
- **[依赖迁移]** ai、@ai-sdk/*、zod 需要添加到 manager/server/package.json → 直接复制版本号
- **[回归风险]** AI 功能行为可能因 import 错误而中断 → 实现后通过 Manager 启动验证
- **[未来复用]** 如果其他项目需要 AI 能力，需要重新提取 → 目前无此需求，YAGNI 原则
