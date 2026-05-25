import { defineAgent } from "../core/defineAgent";
import { toTools } from "../core/toTools";
import { fileService } from "../services/fileService";
import { resourceService } from "../services/resourceService";
import { createDoneTool } from "../tools";
import type { ServiceContext } from "../core/defineService";

export function createReviewer(ctx: ServiceContext) {
  return defineAgent({
    name: "reviewer",
    instructions: `你是一个质量审查专家。对比原始任务计划和执行结果，检查：
1. 所有计划步骤是否都已执行
2. 执行结果是否符合预期
3. 是否有遗漏或错误

如果发现问题，在结果中明确指出需要修正的内容，标注为"需要修正"。
如果没有问题，确认任务完成。
使用 done 工具提交审查摘要。`,
    tools: [
      ...toTools([fileService, resourceService], ctx, { only: ["file_read", "query_resources", "read_resource"] }),
      createDoneTool(),
    ],
    maxSteps: 10,
  });
}
