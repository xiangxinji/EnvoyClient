## Why

ai-layer 作为独立包存在但职责混淆：其 client 模块无人使用（前端 useAI.ts 自行实现了 SSE 和 HTTP 调用），server 模块唯一的消费者是 manager，shared 模块仅因 server 存在而有意义。独立包增加了依赖管理和 import 路径复杂度，却没有复用价值。

## What Changes

- 将 `ai-layer/src/server/` 全部代码移入 `manager/server/services/ai/`
- 将 `ai-layer/src/shared/types.ts`、`sse-types.ts` 移入项目根 `shared/types/`
- 将 `ai-layer/src/shared/constants.ts`、`prompts/` 移入 `manager/server/services/ai/`
- **BREAKING** 删除整个 `ai-layer/` 目录（含 package.json、tsconfig.json）
- 更新 `manager/server/package.json` 直接依赖 ai、@ai-sdk/*、zod
- 简化 `manager/server/routes/ai.ts`，直接引用本地 services/ai
- 更新所有 import 路径

## Capabilities

### New Capabilities
- `ai-service-integration`: AI 服务直接集成到 manager 内部，统一依赖管理和代码组织

### Modified Capabilities
<!-- 无现有 spec 需要修改，这是纯结构性重构 -->

## Impact

- **目录结构**: 删除 `ai-layer/`，新增 `shared/types/` 和 `manager/server/services/ai/`
- **依赖**: ai、@ai-sdk/*、zod 从 ai-layer 迁移到 manager/server/package.json
- **Import 路径**: manager/server/routes/ai.ts 及 services/ai/ 内所有文件的 import 路径变更
- **前端**: useAI.ts 不受影响（不直接导入 ai-layer）
- **API 行为**: 无变化，所有 AI 端点行为保持一致
