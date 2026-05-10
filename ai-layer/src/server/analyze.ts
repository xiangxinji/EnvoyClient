import { generateObject } from "ai";
import { z } from "zod";
import type { Context } from "hono";
import type { AnalyzeRequest, AnalysisResult, AIConfig } from "../shared/types";
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzePrompt } from "../shared/prompts/analyze";
import { resolveModel, getModelOptions } from "./provider";

const analysisSchema = z.object({
  summary: z.string().describe("执行结果总述"),
  issues: z.array(z.string()).describe("发现的问题"),
  suggestions: z.array(z.string()).describe("后续建议"),
});

export async function handleAnalyze(c: Context, config: AIConfig) {
  const body = await c.req.json<AnalyzeRequest>();

  if (!body.taskDescription) {
    return c.json({ error: "taskDescription is required" }, 400);
  }
  if (!body.results?.length) {
    return c.json({ error: "results is required" }, 400);
  }

  const model = resolveModel(config);
  const options = getModelOptions(config);
  const prompt = buildAnalyzePrompt(body.taskDescription, body.results);

  const result = await generateObject({
    model,
    system: ANALYZE_SYSTEM_PROMPT,
    prompt,
    schema: analysisSchema,
    schemaName: "AnalysisResult",
    temperature: Math.min(options.temperature, 0.5),
    maxTokens: options.maxTokens,
  });

  return c.json(result.object as AnalysisResult);
}
