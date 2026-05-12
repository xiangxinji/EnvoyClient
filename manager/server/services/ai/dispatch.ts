import { generateObject } from "ai";
import { z } from "zod";
import type { Context } from "hono";
import type { AIConfig } from "../../../../shared/types/ai.js";
import { DISPATCH_SYSTEM_PROMPT } from "./prompts/dispatch.js";
import { resolveModel, getModelOptions } from "./provider.js";

interface DispatchRequest {
  description: string;
  members: Array<{ id: string; responsibilities: string }>;
}

const dispatchSchema = z.object({
  subscribe: z.array(z.string()).describe("匹配到的成员 ID 列表"),
  content: z.string().describe("优化后的任务描述"),
});

export async function handleTaskDispatch(c: Context, config: AIConfig) {
  const body = await c.req.json<DispatchRequest>();

  if (!body.description) {
    return c.json({ error: "description is required" }, 400);
  }
  if (!body.members?.length) {
    return c.json({ error: "members is required" }, 400);
  }

  const model = resolveModel(config);
  const options = getModelOptions(config);

  const memberList = body.members
    .map((m) => `  - ${m.id}: ${m.responsibilities || "无职责描述"}`)
    .join("\n");

  const prompt = `任务描述：${body.description}\n\n可用成员：\n${memberList}`;

  const result = await generateObject({
    model,
    system: DISPATCH_SYSTEM_PROMPT,
    prompt,
    schema: dispatchSchema,
    schemaName: "TaskDispatch",
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  return c.json(result.object);
}
