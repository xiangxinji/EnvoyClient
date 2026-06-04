## Context

当前任务流水线为 planner → executor → reviewer，reviewer 输出 pass/fail 判断并可能触发重试。reviewer 通过后直接提交结果，无量化评估。

已有基础设施：
- `defineAgent` / `definePipeline` — Agent 和流水线定义
- `brainsService` — 知识库文件浏览和读取
- `reflectionMemory` — 执行日志写入（`~/brains/{user}/raw/日志/执行日志/YYYY-MM-DD.md`）
- `TaskResource` — 自由类型的任务资源（`type` 字段为 string，`data` 为 unknown）
- `TaskResolution.data` — `Record<string, unknown>` 提交数据

## Goals / Non-Goals

**Goals:**
- Scorer 在 reviewer 通过后运行，对任务进行四维评分
- 必须先浏览知识库文件列表，参考历史经验和最佳实践
- 评分结果作为 `task-score` 资源上传到任务详情
- 评分结果追加写入当日执行日志
- Scorer 使用 `createScorerDoneTool` 提交结构化评分

**Non-Goals:**
- Scorer 不影响 reviewer 的 pass/fail 判断和重试逻辑
- 评分不触发任何自动化流程（仅记录）
- 不修改服务端 API

## Decisions

### 1. Scorer 作为流水线第四阶段

**选择**：在 `taskPipeline.ts` 中增加 scorer 作为第四个 stage（`output: "scoreSummary"`），仅在 reviewPassed 时运行

**理由**：与现有架构一致，scorer 的输出自然进入 `PipelineResult.outputs`。pipeline 不需要改 retry 逻辑，因为 scorer 不参与重试。

**实现**：`definePipeline` 不原生支持条件 stage，但可以在 `useTaskCenterExecution` 中判断 `reviewPassed` 后单独运行 scorer，再将结果合并到 pipeline 输出。这比修改 `definePipeline` 核心逻辑更安全。

### 2. 评分数据结构

**选择**：四维评分，每个维度包含 name、score(1-10)、comment

```typescript
interface ScoreDimension {
  name: string;      // "任务理解" | "规划质量" | "执行质量" | "结果质量"
  score: number;     // 1-10
  comment: string;   // 评语
}

interface TaskScoreData {
  dimensions: ScoreDimension[];
  totalScore: number;   // 四项之和
  maxScore: number;     // 固定 40
  summary: string;      // 总评
}
```

### 3. Scorer Done Tool

**选择**：新增 `createScorerDoneTool`，接受 `{ dimensions: ScoreDimension[], summary: string }`

**理由**：结构化输出，比自由文本更可靠。tool 参数中包含完整的评分维度定义，引导 LLM 输出正确格式。

### 4. 评分写入两条路径

**路径 A — 任务资源**：在 `resolveCurrentTask` 的 `data` 中加入 `score` 字段，服务端存储为 `task-score` 类型资源

**路径 B — 执行日志**：`reflectionMemory` 增加评分条目格式，在 `writeTaskReflection` 时如果有 score 数据则追加

### 5. Scorer 的工具集

- `list_brains_files` + `read_brains_file`（必须先用）
- `list_logs` + `read_log`（参考历史）
- `file_read`（读取工作区文件）
- `done`（scorer 版本）

## Risks / Trade-offs

- [Scorer 增加流水线耗时] → Scorer maxSteps 设为 5，只做评估不执行操作，预计 2-3 步完成（列出文件 + 读取参考 + 评分）
- [LLM 评分主观性] → 评分维度和 1-10 刻度在 prompt 中定义明确，减少主观偏差。评分本身就是参考性质，不作为决策依据
- [日志文件过大] → 评分条目控制在合理长度（每项评语限制字数），不显著增加日志体积
