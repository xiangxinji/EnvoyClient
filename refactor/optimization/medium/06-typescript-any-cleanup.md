# 06 - 大量 any 类型清理

## 问题描述

项目前端代码中存在约 20+ 处 `any` 类型使用，分布在 `useAI.ts`、`react.ts`、`tools.ts` 和 `ChatPanel.vue` 等核心文件中。大量 `any` 削弱了 TypeScript 的类型安全保障，导致：

- 编译期无法捕获属性访问错误
- IDE 自动补全失效
- 重构时无法安全追踪依赖
- 运行时 TypeError 风险增加

## 影响范围

| 文件 | any 出现次数 | 严重程度 |
|------|-------------|---------|
| `src/composables/useAI.ts` | 11 | 高 |
| `src/agent/react.ts` | 4 | 中 |
| `src/agent/tools.ts` | 4 | 中 |
| `src/components/ChatPanel.vue` | 3 | 低 |
| `src/composables/useTeamClient.ts` | 2 | 低 |

## 涉及代码

### useAI.ts 中的 any 位置

**位置 1 — 第 53 行**：`parseSSE` 返回值
```typescript
// 当前代码
function parseSSE(raw: string): { event: string; data: any } | null {

// 问题：data 的结构完全未知
```

**位置 2 — 第 78 行**：健康检查响应
```typescript
// 当前代码
.then((h: any) => { aiAvailable.value = h.configured; })
```

**位置 3 — 第 107 行**：suggestReply 的 catch
```typescript
// 当前代码
} catch (e: any) {
  aiError.value = e.message;
```

**位置 4 — 第 139 行**：planTask 的 catch
```typescript
// 当前代码
} catch (e: any) {
  aiError.value = e.message;
```

**位置 5-6 — 第 156-165 行**：analyzeTaskResult 中的资源数据
```typescript
// 当前代码
stdout: typeof r.data === "object" && r.data !== null && "stdout" in (r.data as any)
  ? (r.data as any).stdout ?? ""
  : JSON.stringify(r.data),
stderr: typeof r.data === "object" && r.data !== null && "stderr" in (r.data as any)
  ? (r.data as any).stderr ?? ""
  : "",
exitCode: typeof r.data === "object" && r.data !== null && "exit_code" in (r.data as any)
  ? (r.data as any).exit_code ?? -1
  : 0,
```

**位置 7 — 第 169 行**：analyzeTaskResult 的 catch
```typescript
} catch (e: any) {
```

**位置 8 — 第 185 行**：dispatchTask 的 catch
```typescript
} catch (e: any) {
```

**位置 9-10 — 第 191, 195 行**：reviewTaskResult 参数和内部使用
```typescript
async function reviewTaskResult(taskContent: string, memberResults: any[]): Promise<...> {
  const resultsSummary = memberResults.map((r: any) => ({
```

**位置 11 — 第 209 行**：reviewTaskResult 的 catch
```typescript
} catch (e: any) {
```

### react.ts 中的 any 位置

**位置 12 — 第 12 行**：AgentMessage toolCalls args
```typescript
toolCalls: Array<{ id: string; name: string; args: any }>;
```

**位置 13 — 第 48 行**：truncateToolResult 参数和返回值
```typescript
function truncateToolResult(_toolName: string, result: any): any {
```

**位置 14 — 第 132 行**：toolCalls 映射
```typescript
toolCalls: data.toolCalls.map((c: any) => ({ name: c.name, args: c.args })),
```

**位置 15 — 第 177 行**：catch 错误对象
```typescript
} catch (e: any) {
```

### tools.ts 中的 any 位置

**位置 16-17 — 第 11-16 行**：AgentTool 接口
```typescript
export interface AgentToolSchema {
  parameters: Record<string, any>;
}
export interface AgentTool extends AgentToolSchema {
  execute: (args: Record<string, any>) => Promise<any>;
}
```

### ChatPanel.vue 中的 any 位置

**位置 18 — 第 17 行**：成员查找
```typescript
const m = members.value.find((m: any) => m.id === props.peerId);
```

**位置 19 — 第 165 行**：成员映射
```typescript
const memberList = members.value.map((m: any) => ({ ... }));
```

### useTeamClient.ts 中的 any 位置

**位置 20 — 第 237 行**：资源过滤
```typescript
(r: any) => r.type === "client-result" && r.attempt === task.attempt
```

**位置 21 — 第 277 行**：技能目录加载
```typescript
const catalogResult = await safeInvoke("load_skill_catalog", { username: myId }) as any;
```

## 详细整改方案

### 步骤 1：定义共享类型（`src/types.ts` 中补充）

```typescript
// 在 src/types.ts 中新增以下类型

/** SSE 事件数据联合类型 */
export interface SSETextDelta { text: string }
export interface SSEDone { finishReason: string; usage: { promptTokens: number; completionTokens: number } }
export interface SSEError { message: string }
export type SSEEventData = SSETextDelta | SSEDone | SSEError;

/** AI 健康检查响应 */
export interface AIHealthResponse { configured: boolean; provider: string; model: string }

/** Agent 工具调用 */
export interface ToolCall { id: string; name: string; args: Record<string, unknown> }

/** 工具执行结果 */
export interface ShellToolResult { stdout: string; stderr: string; exit_code: number }
export interface FileReadResult { content: string; error?: string }
export interface FileWriteResult { ok: boolean; error?: string }
export interface DoneToolResult { done: boolean; result: string }
export interface ErrorToolResult { error: string }
export type ToolResult = ShellToolResult | FileReadResult | FileWriteResult | DoneToolResult | ErrorToolResult | Record<string, unknown>;

/** 任务资源（Agent 返回） */
export interface TaskResultResource {
  type: string;
  by: string;
  data: { stdout?: string; stderr?: string; exit_code?: number; result?: string; [key: string]: unknown };
  attempt: number;
}

/** 技能目录条目 */
export interface SkillCatalogEntry { name: string; description: string; filename: string }

/** 技能目录响应 */
export interface SkillCatalogResponse { skills: SkillCatalogEntry[] }
```

### 步骤 2：修复 `useAI.ts`（11 处 -> 0 处）

```typescript
// 修复 1: parseSSE 返回值（第 53 行）
import type { SSEEventData } from "../types";

function parseSSE(raw: string): { event: string; data: SSEEventData } | null {
  // ... 其余不变
}

// 修复 2: 健康检查（第 78 行）
import type { AIHealthResponse } from "../types";

fetch(apiUrl("/api/ai/health"))
  .then((r) => r.json())
  .then((h: AIHealthResponse) => { aiAvailable.value = h.configured; })

// 修复 3, 7, 8, 11: catch 中的 e: any -> 使用类型守卫
// 创建辅助函数：
function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// 使用：
} catch (e: unknown) {
  aiError.value = getErrorMessage(e);
  isStreaming.value = false;
}

// 修复 5-6: analyzeTaskResult 中的资源数据（第 156-165 行）
function extractResultOutput(data: unknown): {
  stdout: string; stderr: string; exit_code: number
} {
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    return {
      stdout: typeof obj.stdout === "string" ? obj.stdout : "",
      stderr: typeof obj.stderr === "string" ? obj.stderr : "",
      exit_code: typeof obj.exit_code === "number" ? obj.exit_code : -1,
    };
  }
  return { stdout: JSON.stringify(data), stderr: "", exit_code: 0 };
}

// 使用：
results: results.map((r) => ({
  memberId: r.by,
  commands: [taskDescription],
  ...extractResultOutput(r.data),
})),

// 修复 9-10: reviewTaskResult 参数（第 191, 195 行）
import type { TaskResultResource } from "../types";

async function reviewTaskResult(
  taskContent: string,
  memberResults: TaskResultResource[],
): Promise<{ success: boolean; summary: string }> {
  // ...
  const resultsSummary = memberResults.map((r) => ({
    from: r.by ?? "unknown",
    data: r.data ?? r,
  }));
  // ...
}
```

### 步骤 3：修复 `react.ts`（4 处 -> 0 处）

```typescript
// 修复 12: AgentMessage toolCalls args（第 12 行）
import type { ToolCall, ToolResult } from "../types";

export type AgentMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      toolCalls: ToolCall[];
    }
  | { role: "tool"; content: string; toolCallId: string; toolName: string };

// 修复 13: truncateToolResult（第 48 行）
function truncateToolResult(
  _toolName: string,
  result: ToolResult,
): ToolResult {
  if (typeof result !== "object" || result === null) return result;

  const truncated = { ...result };
  if ("stdout" in truncated && typeof truncated.stdout === "string" && truncated.stdout.length > 2000) {
    truncated.stdout =
      truncated.stdout.slice(0, 2000) +
      `... (truncated, total ${truncated.stdout.length} chars)`;
  }
  if ("stderr" in truncated && typeof truncated.stderr === "string" && truncated.stderr.length > 1000) {
    truncated.stderr =
      truncated.stderr.slice(0, 1000) +
      `... (truncated, total ${truncated.stderr.length} chars)`;
  }
  return truncated;
}

// 修复 14: toolCalls 映射（第 132 行）
toolCalls: data.toolCalls.map((c: ToolCall) => ({ name: c.name, args: c.args })),

// 修复 15: catch 错误（第 177 行）
} catch (e: unknown) {
  const errMsg = e instanceof Error ? e.message : String(e);
  const errResult = { error: errMsg };
  // ...
}
```

### 步骤 4：修复 `tools.ts`（4 处 -> 保留必要的 any）

```typescript
// 修复 16-17: AgentTool 接口（第 11-16 行）
// JSON Schema 类型本身是动态的，parameters 用 Record<string, unknown> 更准确
// execute 返回值保持 unknown 让调用方做类型收窄

export interface AgentToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentTool extends AgentToolSchema {
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}
```

**说明**：`parameters` 字段是 JSON Schema 对象，其结构是运行时动态的。使用 `Record<string, unknown>` 比 `any` 更安全，同时保留了必要的灵活性。`execute` 返回 `unknown` 让消费方通过类型守卫处理结果。

### 步骤 5：修复 `ChatPanel.vue`（3 处 -> 0 处）

```typescript
// 修复 18: 成员查找（第 17 行）
import type { MemberInfo } from "../types";

const peerStatus = computed(() => {
  const m = members.value.find((m: MemberInfo) => m.id === props.peerId);
  return m?.status;
});

// 修复 19: 成员映射（第 165 行）
const memberList = members.value.map((m: MemberInfo) => ({
  id: m.id,
  responsibilities: m.responsibilities,
}));
```

### 步骤 6：修复 `useTeamClient.ts`（2 处 -> 0 处）

```typescript
// 修复 20: 资源过滤（第 237 行）
import type { TaskResultResource } from "../types";

const memberResults = task.resources.filter(
  (r: TaskResultResource) =>
    r.type === "client-result" && r.attempt === task.attempt,
);

// 修复 21: 技能目录（第 277 行）
import type { SkillCatalogResponse } from "../types";

const catalogResult = await safeInvoke("load_skill_catalog", {
  username: myId,
}) as SkillCatalogResponse | undefined;
const skills = catalogResult?.skills;
```

## 验证方法

1. **编译检查**：
   ```bash
   npx vue-tsc --noEmit
   ```
   确认零 `TS7006`（隐式 any）和 `TS2322`（类型不匹配）错误。

2. **全局搜索验证**：
   ```bash
   grep -rn ": any" src/ --include="*.ts" --include="*.vue"
   ```
   确认目标文件中不再有 `any`（允许保留 `catch (e: unknown)` 模式）。

3. **功能回归**：
   - AI 建议回复正常流式返回
   - Agent 任务执行无运行时类型错误
   - 任务资源上传/查询正常
   - Leader review 流程正常

4. **IDE 验证**：
   - 打开修改后的文件，确认无红色下划线
   - 验证 `Ctrl+Click` 跳转到正确类型定义
   - 验证自动补全提供正确的属性列表
