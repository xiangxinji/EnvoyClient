## ADDED Requirements

### Requirement: Scorer agent definition
系统 SHALL 提供一个 Scorer Agent，在 reviewer 通过后运行，对任务执行进行多维评分。

#### Scenario: Scorer agent creation
- **WHEN** 创建 scorer agent 实例
- **THEN** 其名称为 "scorer"，maxSteps 为 5，工具包含 list_brains_files、read_brains_file、list_logs、read_log、file_read 和 scorer done tool

#### Scenario: Scorer instructions
- **WHEN** scorer agent 收到任务内容
- **THEN** 其系统提示词要求必须先查看知识库文件列表，参考历史经验，然后对四个维度（任务理解、规划质量、执行质量、结果质量）进行 1-10 分评分

### Requirement: Multi-dimensional scoring
Scorer SHALL 对每个任务输出四维评分，每个维度包含名称、分数（1-10）和评语。

#### Scenario: Complete scoring output
- **WHEN** scorer 完成评分
- **THEN** 输出包含四个维度：任务理解、规划质量、执行质量、结果质量，每项有 score（1-10 整数）和 comment（评语），以及 totalScore（四项之和）和 summary（总评）

#### Scenario: Score range validation
- **WHEN** scorer 提交评分
- **THEN** 每个 score 值 MUST 为 1-10 的整数，totalScore 为四项之和（4-40），maxScore 固定为 40

### Requirement: Knowledge base reference before scoring
Scorer SHALL 在评分前必须浏览知识库文件列表，参考相关内容进行评分。

#### Scenario: Scorer reads knowledge base
- **WHEN** scorer 开始评分流程
- **THEN** 必须先调用 list_brains_files 查看知识库文件列表，读取相关文件内容后才能进行评分

### Requirement: Score upload to task details
评分结果 SHALL 作为任务资源上传，类型为 `task-score`。

#### Scenario: Score in task resolution data
- **WHEN** scorer 评分完成且 reviewer 已通过
- **THEN** 评分数据以 `score` 字段写入 `TaskResolution.data`，并随任务结果提交到服务端

### Requirement: Score written to execution log
评分结果 SHALL 追加写入当日执行日志文件。

#### Scenario: Score appended to daily log
- **WHEN** scorer 评分完成
- **THEN** 评分的四维结果和总评以格式化的 Markdown 条目追加到 `~/brains/{user}/raw/日志/执行日志/YYYY-MM-DD.md`

### Requirement: Scorer runs only after reviewer passes
Scorer SHALL 仅在 reviewer 判定通过（passed=true）后运行。

#### Scenario: Reviewer passes
- **WHEN** reviewer 输出 passed=true
- **THEN** scorer 作为流水线下一阶段运行

#### Scenario: Reviewer fails
- **WHEN** reviewer 输出 passed=false 且重试次数耗尽
- **THEN** scorer 不运行，任务结果中无评分数据

### Requirement: Scorer does not affect retry logic
Scorer 的运行和评分 SHALL 不影响 reviewer 的 pass/fail 判断和 executor 的重试逻辑。

#### Scenario: Scorer output does not trigger retry
- **WHEN** scorer 输出评分结果
- **THEN** 该结果不参与 pipeline 的 shouldRetry 判断，不影响 executor 重试

### Requirement: Scorer done tool
系统 SHALL 提供专用的 `createScorerDoneTool`，接受结构化的多维评分参数。

#### Scenario: Scorer done tool parameters
- **WHEN** scorer 调用 done 工具
- **THEN** 工具接受 `dimensions`（四个评分维度数组）和 `summary`（总评），每个维度包含 name、score、comment

#### Scenario: Scorer done tool output
- **WHEN** scorer done 工具执行
- **THEN** 返回 `{ done: true, result: JSON.stringify({ dimensions, totalScore, maxScore: 40, summary }) }`
