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

使用 done 工具提交审查结果，result 参数必须是合法 JSON，格式如下：
通过：{"passed": true, "summary": "审查通过的简短说明"}
未通过：{"passed": false, "summary": "发现的具体问题描述"}

不要输出 JSON 以外的内容，不要用 markdown 代码块包裹。`,
    tools: [
      ...toTools([fileService, resourceService], ctx, { only: ["file_read", "query_resources", "read_resource"] }),
      createDoneTool(),
    ],
    maxSteps: 10,
  });
}
