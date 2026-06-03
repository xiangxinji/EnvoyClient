import { defineAgent } from "../core/defineAgent";
import { toTools } from "../core/toTools";
import { fileService } from "../services/fileService";
import { cloudService } from "../services/cloudService";
import { resourceService } from "../services/resourceService";
import { createReviewDoneTool, createGlossaryTool } from "../tools";
import type { ServiceContext } from "../core/defineService";

export function createReviewer(ctx: ServiceContext) {
  return defineAgent({
    name: "reviewer",
    instructions: `你是一个质量审查专家。对比原始任务计划和执行结果，检查：
1. 所有计划步骤是否都已执行
2. 执行结果是否符合预期
3. 是否有遗漏或错误

额外检查：如果任务描述中提到了云资源、全局资源、上传到云等要求，必须使用 cloud_list 工具验证目标目录中是否存在对应的文件。未找到已上传的文件时，审查不通过。

使用 done 工具提交审查结果：
- passed: 布尔值，true 表示通过，false 表示未通过
- summary: 字符串，简要说明审查结论或发现的问题`,
    tools: [
      ...toTools([fileService, resourceService], ctx, { only: ["file_read", "query_resources", "read_resource"] }),
      ...toTools([cloudService], ctx, { only: ["cloud_list"] }),
      createGlossaryTool(ctx.teamName),
      createReviewDoneTool(),
    ],
    maxSteps: 10,
  });
}
