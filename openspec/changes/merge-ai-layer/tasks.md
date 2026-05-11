## 1. 创建共享类型目录

- [x] 1.1 创建 `shared/types/ai.ts`，提取 `ai-layer/src/shared/types.ts` 中的类型定义（AIConfig、ChatRequest、TaskPlan、AnalysisResult 等）
- [x] 1.2 创建 `shared/types/sse.ts`，提取 `ai-layer/src/shared/sse-types.ts` 中的 SSE 类型定义

## 2. 创建 manager AI 服务目录

- [x] 2.1 创建 `manager/server/services/ai/` 目录，将 `ai-layer/src/server/` 下所有文件复制过来：chat.ts、task.ts、analyze.ts、config.ts、provider.ts、stream.ts、index.ts
- [x] 2.2 复制 `ai-layer/src/shared/constants.ts` 到 `manager/server/services/ai/constants.ts`
- [x] 2.3 复制 `ai-layer/src/shared/prompts/` 目录到 `manager/server/services/ai/prompts/`
- [x] 2.4 更新 `manager/server/services/ai/` 内所有文件的 import 路径（从 `../shared/` 改为相对路径引用 shared/types 和本地 constants/prompts）

## 3. 更新 manager 路由

- [x] 3.1 修改 `manager/server/routes/ai.ts`，将 `ai-layer/src/server` 的 import 改为 `../services/ai`

## 4. 更新依赖

- [x] 4.1 将 ai、@ai-sdk/openai、@ai-sdk/anthropic、@ai-sdk/google、@ai-sdk/deepseek、zod 添加到 `manager/server/package.json` 的 dependencies（版本号与 ai-layer/package.json 一致）

## 5. 清理

- [x] 5.1 删除整个 `ai-layer/` 目录
