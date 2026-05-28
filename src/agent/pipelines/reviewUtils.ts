export interface ReviewOutput {
  passed: boolean;
  summary: string;
}

export function parseReviewOutput(raw: string): ReviewOutput {
  if (!raw || typeof raw !== "string") {
    return { passed: false, summary: "Review output empty or invalid" };
  }

  // Strategy 1: Direct JSON.parse
  try {
    const obj = JSON.parse(raw);
    if (typeof obj === "object" && obj !== null) {
      return normalizeReviewObject(obj);
    }
  } catch {
    // continue
  }

  // Strategy 2: Extract JSON from markdown code blocks
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try {
      const obj = JSON.parse(codeBlockMatch[1]);
      if (typeof obj === "object" && obj !== null) {
        return normalizeReviewObject(obj);
      }
    } catch {
      // continue
    }
  }

  // Strategy 3: Find first { ... last } and try to parse
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const obj = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      if (typeof obj === "object" && obj !== null) {
        return normalizeReviewObject(obj);
      }
    } catch {
      // continue
    }
  }

  // Strategy 4: Keyword heuristic (fail-safe: default NOT passed)
  const lower = raw.toLowerCase();
  const hasPassKeyword = lower.includes("通过") || lower.includes("passed") || lower.includes("pass");
  const hasFailKeyword = lower.includes("需要修正") || lower.includes("发现问题")
    || lower.includes("未通过") || lower.includes("failed") || lower.includes("不通过")
    || lower.includes("fail") || lower.includes("错误") || lower.includes("遗漏");

  if (hasPassKeyword && !hasFailKeyword) {
    return { passed: true, summary: raw.slice(0, 200) };
  }

  return { passed: false, summary: raw.slice(0, 200) || "Review output could not be parsed" };
}

function normalizeReviewObject(obj: Record<string, unknown>): ReviewOutput {
  return {
    passed: obj.passed === true,
    summary: typeof obj.summary === "string" ? obj.summary : JSON.stringify(obj).slice(0, 200),
  };
}
