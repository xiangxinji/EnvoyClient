import { definePipeline } from "../core/definePipeline";
import { createPlanner } from "../agents/planner";
import { createExecutor } from "../agents/executor";
import { createReviewer } from "../agents/reviewer";
import { createScorer } from "../agents/scorer";
import type { ServiceContext } from "../core/defineService";
import type { ExecutionEventHandler } from "../react";
import { parseReviewOutput } from "./reviewUtils";

export interface TaskPipelineOptions {
  ctx: ServiceContext;
  skillCatalog?: string;
  maxRetryAttempts?: number;
  onEvent?: ExecutionEventHandler;
}

export function createTaskPipeline(opts: TaskPipelineOptions) {
  const planner = createPlanner(opts.ctx);
  const executor = createExecutor(opts.ctx, opts.skillCatalog);
  const reviewer = createReviewer(opts.ctx);

  const pipeline = definePipeline({
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
        const review = parseReviewOutput(reviewOutput);
        return !review.passed;
      },
    },
  });

  return {
    run(taskContent: string) {
      return pipeline.run(taskContent, opts.onEvent);
    },
    createScorerAgent() {
      return createScorer(opts.ctx);
    },
  };
}
