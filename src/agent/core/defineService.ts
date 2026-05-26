export interface ServiceContext {
  teamName: string;
  myId: string;
  taskId?: string;
  workspacePath?: string;
}

export interface ServiceOperation<TArgs = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: TArgs, ctx: ServiceContext) => Promise<unknown>;
}

export interface ServiceDefinition {
  name: string;
  operations: ServiceOperation[];
}

export function defineService(def: ServiceDefinition): ServiceDefinition {
  return def;
}
