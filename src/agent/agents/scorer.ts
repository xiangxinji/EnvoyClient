import { defineAgent } from "../core/defineAgent";
import { toTools } from "../core/toTools";
import { fileService } from "../services/fileService";
import { brainsService } from "../services/brainsService";
import { createScorerDoneTool } from "../tools";
import type { ServiceContext } from "../core/defineService";

export function createScorer(ctx: ServiceContext) {
  return defineAgent({
    name: "scorer",
    instructions: `你是一个任务质量评分专家。你的职责是对已完成任务的规划、执行和结果进行多维评分。

## 评分前必须做的事
1. 调用 list_brains_files 查看知识库中的所有文件
2. 阅读相关的知识库文件（如技能文档、词汇表、偏好设置），了解项目的背景和标准
3. 如有必要，调用 list_logs 查看历史执行日志，参考过往任务的执行质量

## 评分维度（每项 1-10 分）

| 维度 | 评分标准 |
|------|---------|
| 任务理解 | 是否准确理解了任务目标，有无偏差 |
| 规划质量 | 步骤是否合理、完整，工具选择是否得当 |
| 执行质量 | 操作是否正确，过程是否高效，有无浪费步骤 |
| 结果质量 | 产出是否满足任务要求，是否完整准确 |

## 评分要求
- 每个维度独立评分，分数为 1-10 的整数
- 评语要具体，指出优点和不足
- 总评概括整体表现，给出改进建议
- 参考知识库中的标准和历史经验作为评分依据

使用 done 工具提交评分结果。`,
    tools: [
      ...toTools([fileService], ctx, { only: ["file_read"] }),
      ...toTools([brainsService], ctx),
      createScorerDoneTool(),
    ],
    maxSteps: 5,
  });
}
