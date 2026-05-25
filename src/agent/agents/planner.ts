import { defineAgent } from "../core/defineAgent";
import { toTools } from "../core/toTools";
import { fileService } from "../services/fileService";
import { createDoneTool } from "../tools";
import type { ServiceContext } from "../core/defineService";

export function createPlanner(ctx: ServiceContext) {
  return defineAgent({
    name: "planner",
    instructions: `你是一个任务规划专家。分析任务要求，制定详细的执行计划。
你的输出应该是一个结构化的执行计划，包含：
1. 任务分解步骤
2. 每个步骤需要使用的工具
3. 预期输出和验收标准

完成后使用 done 工具提交计划。`,
    tools: [...toTools([fileService], ctx, { only: ["file_read", "shell"] }), createDoneTool()],
    maxSteps: 10,
  });
}
