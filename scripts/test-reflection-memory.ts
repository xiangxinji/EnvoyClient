import assert from "node:assert/strict";

(globalThis as { window?: Record<string, unknown> }).window = {};
(globalThis as {
  localStorage?: {
    getItem: () => null;
    setItem: () => void;
    removeItem: () => void;
  };
}).localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const {
  buildTaskReflectionPath,
  createTaskReflectionMarkdown,
  generateTaskTitle,
  mergeDailyExecutionLog,
  sanitizeText,
  shouldWriteTaskReflection,
  writeTaskReflection,
} = await import("../src/agent/reflectionMemory");
const { parseTaskLogDraft } = await import("../src/agent/agents/logEvaluator");

const completedAt = new Date("2026-06-03T12:34:56.000Z");
const path = buildTaskReflectionPath({
  username: "alice",
  taskId: "task/123 secret",
  completedAt,
});

assert.equal(
  path,
  "~/brains/alice/raw/\u65e5\u5fd7/\u6267\u884c\u65e5\u5fd7/2026-06-03.md",
);

assert.equal(sanitizeText("token=abc123"), "token=[REDACTED]");
assert.equal(sanitizeText('"password": "secret"'), '"password": [REDACTED]');
assert.equal(shouldWriteTaskReflection(false, true), false);
assert.equal(shouldWriteTaskReflection(true, false), false);
assert.equal(shouldWriteTaskReflection(true, true), true);

const failedMarkdown = createTaskReflectionMarkdown({
  username: "alice",
  taskId: "task-123",
  taskContent: "Use api_key=abc123 to do work",
  success: false,
  plan: "Plan output",
  execSummary: "Execution failed",
  reviewSummary: "Reviewer rejected the result",
  attempts: 2,
  completedAt,
  trace: [
    {
      index: 1,
      reasoning: "Need to inspect files",
      agent: "executor",
      attempt: 1,
      toolCalls: [{ name: "file_read", args: { path: "~/workspace/report.md" } }],
      toolResults: [{ name: "file_read", result: { content: "x".repeat(1800), password: "secret" } }],
    },
  ],
});

assert.match(failedMarkdown, /## 任务标题：/);
assert.match(failedMarkdown, /### 任务描述/);
assert.match(failedMarkdown, /### 执行过程/);
assert.match(failedMarkdown, /### 任务结果/);
assert.match(failedMarkdown, /状态：失败/);
assert.match(failedMarkdown, /### 执行复盘/);
assert.match(failedMarkdown, /\[REDACTED\]/);
assert.doesNotMatch(failedMarkdown, /abc123/);
assert.doesNotMatch(failedMarkdown, /secret/);
assert.doesNotMatch(failedMarkdown, /x{100}/);

const dirtyMarkdown = createTaskReflectionMarkdown({
  username: "alice",
  taskId: "task-789",
  taskContent: "写一个粒子特效的 html 上传到云资源。",
  success: true,
  plan: "## 任务执行计划\n### 任务目标\n编写一个粒子特效的 HTML 文件，并上传到云资源。\n### 执行步骤\n创建文件\n上传资源",
  execSummary: "## 执行摘要\n创建 particle.html 并上传到云资源。",
  reviewSummary: JSON.stringify({
    passed: true,
    summary: "审查通过。任务要求已全部完成。",
  }),
  attempts: 1,
  trace: [],
  completedAt,
});

assert.doesNotMatch(dirtyMarkdown, /## 执行摘要/);
assert.doesNotMatch(dirtyMarkdown, /### 任务目标/);
assert.doesNotMatch(dirtyMarkdown, /\{"passed"/);
assert.match(dirtyMarkdown, /审查通过/);
assert.match(dirtyMarkdown, /## 任务标题：创建 particle\.html/);
assert.doesNotMatch(dirtyMarkdown, /- 任务执行计划/);
assert.doesNotMatch(dirtyMarkdown, /- 任务目标/);

assert.equal(parseTaskLogDraft(JSON.stringify({
  title: "## 执行摘要",
  description: "描述",
  process: ["步骤"],
  result: "结果",
  review: ["复盘"],
})), null);

assert.equal(
  generateTaskTitle({
    username: "alice",
    taskId: "task-456",
    taskContent: "请帮我整理今天的任务复盘日志结构，并保持简洁。",
    success: true,
    execSummary: "整理每日执行日志结构",
    attempts: 1,
    trace: [],
    completedAt,
  }),
  "整理每日执行日志结构",
);

const merged = mergeDailyExecutionLog(null, failedMarkdown);
assert.match(merged, /^# 执行日志/);
const mergedAgain = mergeDailyExecutionLog(merged, failedMarkdown);
assert.match(mergedAgain, /---/);

const writeResult = await writeTaskReflection({
  username: "alice",
  taskId: "task-123",
  taskContent: "browser mode",
  success: true,
  attempts: 1,
  trace: [],
  completedAt,
});

assert.equal(writeResult, null);

console.log("reflection memory tests passed");
