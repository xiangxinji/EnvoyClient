import type { AgentTool } from "../tools";
import type { ServiceContext, ServiceDefinition } from "./defineService";

export interface ToToolsOptions {
  only?: string[];
  exclude?: string[];
}

export function toTools(
  services: ServiceDefinition[],
  ctx: ServiceContext,
  options?: ToToolsOptions,
): AgentTool[] {
  const onlySet = options?.only ? new Set(options.only) : null;
  const excludeSet = options?.exclude ? new Set(options.exclude) : null;
  const tools: AgentTool[] = [];

  for (const service of services) {
    for (const op of service.operations) {
      if (onlySet && !onlySet.has(op.name)) continue;
      if (excludeSet?.has(op.name)) continue;

      tools.push({
        name: op.name,
        description: op.description,
        parameters: op.parameters,
        execute: (args) => op.run(args, ctx),
      });
    }
  }

  return tools;
}
