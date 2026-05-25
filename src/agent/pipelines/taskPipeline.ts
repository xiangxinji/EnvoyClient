import { definePipeline } from "../core/definePipeline";
import { createPlanner } from "../agents/planner";
import { createExecutor } from "../agents/executor";
import { createReviewer } from "../agents/reviewer";
import type { ServiceContext } from "../core/defineService";

export interface TaskPipelineOptions {
  ctx: ServiceContext;
  skillCatalog?: string;
  maxRetryAttempts?: number;
}

export function createTaskPipeline(opts: TaskPipelineOptions) {
  const planner = createPlanner(opts.ctx);
  const executor = createExecutor(opts.ctx, opts.skillCatalog);
  const reviewer = createReviewer(opts.ctx);

  return definePipeline({
    stages: [
      { agent: planner, output: "plan" },
      { agent: executor, output: "execSummary" },
      { agent: reviewer, output: "reviewSummary" },
    ],
    retry: {
      from: "executor",
      maxAttempts: opts.maxRetryAttempts ?? 2,
      feedback: "reviewSummary",
      shouldRetry: (reviewOutput: string) => {
        return reviewOutput.includes("需要修正") || reviewOutput.includes("发现问题");
      },
    },
  });
}
