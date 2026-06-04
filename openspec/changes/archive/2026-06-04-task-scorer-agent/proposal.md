## Why

任务执行后只有 reviewer 的 pass/fail 判断，缺乏量化的质量评估。加入 Scorer Agent 可以从多个维度对任务执行质量打分，评分结果写入任务详情和执行日志，为团队提供可追溯的质量指标，也为后续自动化优化提供数据基础。

## What Changes

- 新增 Scorer Agent（`src/agent/agents/scorer.ts`），在 reviewer 通过后运行，对任务进行多维评分
- 评分维度：任务理解、规划质量、执行质量、结果质量，每项 1-10 分 + 评语
- Scorer 必须先查看知识库文件列表，参考历史经验和最佳实践进行评分
- 评分结果作为任务资源（`type: "task-score"`）上传到任务详情
- 评分结果追加写入当日执行日志
- 修改任务流水线，在 reviewer 之后增加 scorer 阶段

## Capabilities

### New Capabilities
- `task-scorer-agent`: 在 reviewer 通过后对任务执行进行多维评分，参考知识库，分数上传任务详情并写入执行日志

### Modified Capabilities

## Impact

- **新增文件**: `src/agent/agents/scorer.ts`
- **修改文件**: `src/agent/pipelines/taskPipeline.ts`（增加 scorer 阶段）
- **修改文件**: `src/composables/useTaskCenterExecution.ts`（评分结果写入日志和任务数据）
- **修改文件**: `src/agent/tools.ts`（新增 `createScorerDoneTool`）
- **修改文件**: `src/types.ts`（新增 `TaskScoreData` 类型）
- **修改文件**: `src/agent/reflectionMemory.ts`（支持写入评分条目）
