import { defineAgent } from "../core/defineAgent";
import { toTools } from "../core/toTools";
import { fileService } from "../services/fileService";
import { cloudService } from "../services/cloudService";
import { resourceService } from "../services/resourceService";
import { createDoneTool } from "../tools";
import type { ServiceContext } from "../core/defineService";

export function createExecutor(ctx: ServiceContext, skillCatalog?: string) {
  const serviceTools = toTools([fileService, cloudService, resourceService], ctx);

  return defineAgent({
    name: "executor",
    instructions: `你是一个任务执行专家。根据提供的计划或任务要求，使用可用工具执行具体操作。
每一步都要确认操作结果。完成所有操作后，使用 done 工具提交执行摘要，包含：
1. 执行了哪些操作
2. 每步的结果
3. 最终产出物`,
    tools: [...serviceTools, createDoneTool()],
    maxSteps: 20,
    workspacePath: ctx.workspacePath,
    skillCatalog,
  });
}
