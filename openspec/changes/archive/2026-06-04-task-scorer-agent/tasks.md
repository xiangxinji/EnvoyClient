## 1. 新增类型和工具

- [x] 1.1 在 `src/types.ts` 中新增 `ScoreDimension` 和 `TaskScoreData` 类型定义
- [x] 1.2 在 `src/agent/tools.ts` 中新增 `createScorerDoneTool`，接受 `{ dimensions, summary }` 参数，返回结构化评分 JSON

## 2. 新增 Scorer Agent

- [x] 2.1 创建 `src/agent/agents/scorer.ts`，使用 `defineAgent` 定义 scorer，包含系统提示词（必须先看知识库、四维评分 1-10）和工具集（brainsService 四个工具 + file_read + scorer done tool）

## 3. 集成到流水线

- [x] 3.1 修改 `src/agent/pipelines/taskPipeline.ts`：导出 scorer 工厂函数供外部调用（不在 pipeline stages 中直接添加，因为 scorer 仅在 reviewPassed 时运行）
- [x] 3.2 修改 `src/composables/useTaskCenterExecution.ts`：在 pipeline 完成后判断 reviewPassed，若通过则运行 scorer，将评分结果加入 TaskResolution.data 并写入执行日志

## 4. 执行日志写入评分

- [x] 4.1 修改 `src/agent/reflectionMemory.ts`：新增 `appendScoreToLog` 函数，将评分数据格式化为 Markdown 条目追加到当日日志文件
