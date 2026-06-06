const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/ (["']?(?:api[_-]?key|token|password|passwd|secret|authorization)["']?\s*[:=]\s*)["']?[^"',\s}]+["']?/gi, "$1[REDACTED]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]"],
  [/(bearer\s+)[a-z0-9._~+/=-]+/gi, "$1[REDACTED]"],
];

export function sanitizeText(value: string): string {
  let text = value;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export function sanitizeLogField(value: string): string {
  return stripFormattingNoise(value).replace(/\r?\n{3,}/g, "\n\n").trim() || "无";
}

function stripFormattingNoise(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map(cleanLogLine)
    .filter((line) => line.length > 0)
    .join("\n");
}

function cleanLogLine(value: string): string {
  return value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*•\d.\s:：]+/, "")
    .trim();
}
