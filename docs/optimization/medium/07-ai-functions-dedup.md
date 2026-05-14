# 07 - AI 函数结构重复

## 问题描述

`src/composables/useAI.ts` 中有 4 个 AI 函数（`planTask`、`analyzeTaskResult`、`dispatchTask`、`reviewTaskResult`）共享完全相同的结构模式：

1. 清空 `aiError`
2. `try` 包裹 `managerFetch`
3. 构造 POST 请求（相同 headers、method）
4. 解析 JSON 响应
5. `catch` 中设置 `aiError` 并返回 `null` 或默认值

这种重复导致：
- 新增 AI 函数时需要复制粘贴整个模式
- 统一修改（如添加重试逻辑、超时控制）需要修改 4 处
- 错误处理逻辑不一致风险（如忘记清空 `aiError`）

## 影响范围

- **直接文件**: `src/composables/useAI.ts`
- **消费方**: `ChatPanel.vue`（`planTask`, `dispatchTask`）、`useTeamClient.ts`（`reviewTaskResult`）

## 涉及代码

### 当前重复模式对比

```typescript
// planTask (第 125-142 行)
async function planTask(description: string, members: MemberInfo[]) {
  aiError.value = "";                                           // 1. 清空错误
  try {
    const res = await managerFetch("/api/ai/task/generate", {   // 2. fetch
      method: "POST",                                           // 3. POST
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, members: ... }),
    });
    return await res.json();                                    // 4. 解析 JSON
  } catch (e: any) {
    aiError.value = e.message;                                  // 5. 设置错误
    return null;
  }
}

// analyzeTaskResult (第 144-173 行)
async function analyzeTaskResult(...) {
  aiError.value = "";                                           // 完全相同模式
  try {
    const res = await managerFetch("/api/ai/task/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ... }),
    });
    return await res.json();
  } catch (e: any) {
    aiError.value = e.message;
    return null;
  }
}

// dispatchTask (第 175-189 行)
async function dispatchTask(...) {
  aiError.value = "";                                           // 完全相同模式
  try {
    const res = await managerFetch("/api/ai/task/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ... }),
    });
    return await res.json() as { subscribe: string[]; content: string };
  } catch (e: any) {
    aiError.value = e.message;
    return null;
  }
}

// reviewTaskResult (第 191-213 行)
async function reviewTaskResult(...) {
  aiError.value = "";
  try {
    const res = await managerFetch("/api/ai/task/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ... }),
    });
    return await res.json() as { success: boolean; summary: string };
  } catch (e: any) {
    aiError.value = e.message;
    return { success: false, summary: `Review failed: ${e.message}` };
  }
}
```

唯一差异点：

| 函数 | URL | 请求体 | 返回类型 | 失败返回值 |
|------|-----|--------|---------|-----------|
| `planTask` | `/api/ai/task/generate` | `{ description, members }` | `TaskPlan (隐式)` | `null` |
| `analyzeTaskResult` | `/api/ai/task/analyze` | `{ taskDescription, results }` | `any (隐式)` | `null` |
| `dispatchTask` | `/api/ai/task/dispatch` | `{ description, members }` | `{ subscribe, content }` | `null` |
| `reviewTaskResult` | `/api/ai/task/review` | `{ taskDescription, results }` | `{ success, summary }` | `{ success: false, ... }` |

## 详细整改方案

### 步骤 1：抽取通用 `aiPost<T>` 辅助函数

在 `useAI.ts` 内部添加：

```typescript
/**
 * 通用 AI POST 请求辅助函数
 * 统一处理：错误清理、请求构造、JSON 解析、错误捕获
 */
async function aiPost<T>(
  url: string,
  body: Record<string, unknown>,
  fallback: T,
): Promise<T | null> {
  aiError.value = "";
  try {
    const res = await managerFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as T;
  } catch (e: unknown) {
    aiError.value = e instanceof Error ? e.message : String(e);
    return fallback;
  }
}
```

### 步骤 2：简化四个函数

```typescript
// planTask — 从 18 行简化为 8 行
async function planTask(description: string, members: MemberInfo[]) {
  return aiPost<TaskPlan>("/api/ai/task/generate", {
    description,
    members: members.map((m) => ({ id: m.id, role: m.role })),
  }, null);
}

// analyzeTaskResult — 从 30 行简化为 15 行
async function analyzeTaskResult(
  taskDescription: string,
  results: TaskMessage["resources"],
) {
  return aiPost<unknown>("/api/ai/task/analyze", {
    taskDescription,
    results: results.map((r) => ({
      memberId: r.by,
      commands: [taskDescription],
      stdout: typeof r.data === "object" && r.data !== null && "stdout" in r
        ? (r.data as { stdout?: string }).stdout ?? ""
        : JSON.stringify(r.data),
      stderr: typeof r.data === "object" && r.data !== null && "stderr" in r
        ? (r.data as { stderr?: string }).stderr ?? ""
        : "",
      exitCode: typeof r.data === "object" && r.data !== null && "exit_code" in r
        ? (r.data as { exit_code?: number }).exit_code ?? -1
        : 0,
    })),
  }, null);
}

// dispatchTask — 从 15 行简化为 7 行
async function dispatchTask(
  description: string,
  members: Array<{ id: string; responsibilities?: string }>,
) {
  return aiPost<{ subscribe: string[]; content: string }>(
    "/api/ai/task/dispatch",
    { description, members },
    null,
  );
}

// reviewTaskResult — 从 23 行简化为 12 行
async function reviewTaskResult(
  taskContent: string,
  memberResults: TaskResultResource[],
): Promise<{ success: boolean; summary: string }> {
  return aiPost(
    "/api/ai/task/review",
    {
      taskDescription: taskContent,
      results: memberResults.map((r) => ({
        from: r.by ?? "unknown",
        data: r.data ?? r,
      })),
    },
    { success: false, summary: "Review failed" },
  ) as Promise<{ success: boolean; summary: string }>;
}
```

### 步骤 3：（可选）支持超时和重试

`aiPost` 的设计使得后续增加横切关注点非常容易：

```typescript
async function aiPost<T>(
  url: string,
  body: Record<string, unknown>,
  fallback: T,
  options?: { timeout?: number; retries?: number },
): Promise<T | null> {
  aiError.value = "";

  const controller = new AbortController();
  const timeoutId = options?.timeout
    ? setTimeout(() => controller.abort(), options.timeout)
    : undefined;

  let lastError: Error | undefined;
  const maxAttempts = (options?.retries ?? 0) + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await managerFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return (await res.json()) as T;
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  clearTimeout(timeoutId);
  aiError.value = lastError?.message ?? "Unknown error";
  return fallback;
}
```

### 步骤 4：`suggestReply` 也可以统一（可选）

`suggestReply` 使用 SSE 而非普通 POST，所以不适合 `aiPost`，但可以提取共用的错误处理：

```typescript
function handleAIError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  aiError.value = msg;
  return msg;
}
```

## 重构前后对比

```
重构前 useAI.ts:
  planTask:          18 行（含样板代码）
  analyzeTaskResult: 30 行（含样板代码）
  dispatchTask:      15 行（含样板代码）
  reviewTaskResult:  23 行（含样板代码）
  合计:              86 行

重构后 useAI.ts:
  aiPost 辅助函数:   12 行
  planTask:           8 行
  analyzeTaskResult: 15 行
  dispatchTask:       7 行
  reviewTaskResult:  12 行
  合计:              54 行

净减少: 32 行（37%），新增横切功能只需改一处
```

## 验证方法

1. **功能回归测试**：
   - `planTask`: 在 ChatPanel 中触发 AI 任务生成，验证返回 `TaskPlan` 结构正确
   - `analyzeTaskResult`: 在任务结果面板触发分析，验证返回分析结果
   - `dispatchTask`: 在 ChatPanel 中触发 AI 分派，验证返回 `{ subscribe, content }`
   - `reviewTaskResult`: Leader review 流程，验证返回 `{ success, summary }`

2. **错误场景测试**：
   - 断开 Manager 连接，调用各函数，验证 `aiError` 正确设置
   - 返回非 JSON 响应，验证 catch 正常工作
   - 返回 500 错误，验证 fallback 值正确返回

3. **类型安全**：
   - `aiPost<TaskPlan>` 的返回值应当被 TypeScript 识别为 `TaskPlan | null`
   - 调用方无需类型断言

4. **接口兼容**：
   - 4 个函数的签名和返回类型不变
   - `ChatPanel.vue`、`useTeamClient.ts` 等消费方无需修改
