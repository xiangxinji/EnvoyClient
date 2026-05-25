import type { AgentTool } from "../tools";

export interface ToolDefinition<TArgs = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: TArgs) => Promise<unknown>;
}

export function defineTool<TArgs = Record<string, unknown>>(
  def: ToolDefinition<TArgs>,
): AgentTool {
  return {
    name: def.name,
    description: def.description,
    parameters: def.parameters,
    execute: (args) => def.execute(args as TArgs),
  };
}
