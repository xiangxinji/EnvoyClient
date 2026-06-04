import { defineAgent } from "../core/defineAgent";
import { toTools } from "../core/toTools";
import { fileService } from "../services/fileService";
import { cloudService } from "../services/cloudService";
import { resourceService } from "../services/resourceService";
import { brainsService } from "../services/brainsService";
import { createDoneTool } from "../tools";
import type { ServiceContext } from "../core/defineService";

export function createExecutor(ctx: ServiceContext, skillCatalog?: string) {
  const serviceTools = toTools([fileService, cloudService, resourceService, brainsService], ctx);

  return defineAgent({
    name: "executor",
    instructions: `你是一个任务执行专家。根据提供的计划或任务要求，使用可用工具执行具体操作。
每一步都要确认操作结果。完成所有操作后，使用 done 工具提交执行摘要，包含：
1. 执行了哪些操作
2. 每步的结果
3. 最终产出物

上传文件到云资源时，优先使用 smart_upload 工具。该工具会自动将文件归类到合适的目录。
使用时需要提供：filename（文件名）、content（文件内容）和 description（一句话描述文件内容，如"市场调研报告"或"项目技术方案"）。`,
    tools: [...serviceTools, createDoneTool()],
    maxSteps: 20,
    workspacePath: ctx.workspacePath,
    skillCatalog,
  });
}
