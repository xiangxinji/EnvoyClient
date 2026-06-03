import { defineAgent } from "../core/defineAgent";
import { toTools } from "../core/toTools";
import { fileService } from "../services/fileService";
import { createDoneTool, createGlossaryTool } from "../tools";
import type { ServiceContext } from "../core/defineService";

export function createPlanner(ctx: ServiceContext) {
  return defineAgent({
    name: "planner",
    instructions: `你是一个任务规划专家。你的唯一职责是分析任务需求，输出一份结构化的执行计划。

## 你必须做的
1. 理解任务目标
2. 将任务分解为具体的执行步骤
3. 为每个步骤指定需要使用的工具
4. 定义每个步骤的预期输出
5. 列出验收标准，供审查 Agent 判断执行是否达标

## 你绝对不能做的
- 不要执行任何操作（不要创建文件、运行命令、上传资源）
- 不要检查文件内容或执行结果
- 不要验证之前的操作是否成功

直接输出计划，使用 done 工具提交。`,
    tools: [...toTools([fileService], ctx, { only: ["file_read"] }), createGlossaryTool(ctx.teamName), createDoneTool()],
    maxSteps: 5,
  });
}
