# 08 - isTauri/safeInvoke 重复定义

## 问题描述

`isTauri` 环境检测和 `safeInvoke` 安全调用在项目中多处重复定义：

- `src/composables/useTeamClient.ts`（第 13-18 行）
- `src/agent/tools.ts`（第 4 行）

两个文件各自独立定义了 `const isTauri = "__TAURI_INTERNALS__" in window`，`tools.ts` 还在每个工具的 `execute` 函数内重复 `if (!isTauri) return { error: "Not in Tauri environment" }` 检查（出现了 4 次）。

这种重复导致：
- 修改检测逻辑时需要同步多处（例如添加新的 Tauri 版本检测）
- `safeInvoke` 的行为如果不一致（如一个返回 `undefined`，另一个抛异常），会导致难以排查的 bug
- 新文件需要复制粘贴这些工具函数

## 影响范围

- **重复定义位置**:
  - `src/composables/useTeamClient.ts:13-18` — `isTauri` + `safeInvoke`
  - `src/agent/tools.ts:4` — `isTauri`
- **使用 isTauri 的地方**:
  - `useTeamClient.ts:261` — 浏览器模式跳过 Agent 执行
  - `tools.ts:32,53,74,117,238` — 5 个工具的 execute 中检测环境
- **使用 safeInvoke 的地方**:
  - `useTeamClient.ts:63,76,311,315,317,327` — 6 处 Tauri invoke 调用

## 涉及代码

### 重复定义 1：useTeamClient.ts 第 13-18 行

```typescript
const isTauri = "__TAURI_INTERNALS__" in window;

function safeInvoke(cmd: string, args: Record<string, unknown>) {
  if (!isTauri) return Promise.resolve();
  return invoke(cmd, args);
}
```

### 重复定义 2：tools.ts 第 4 行

```typescript
const isTauri = "__TAURI_INTERNALS__" in window;
```

### tools.ts 中的重复检查（4 处）

```typescript
// createShellTool (第 32 行)
execute: async ({ command }) => {
  if (!isTauri) return { error: "Not in Tauri environment" };
  return invoke("shell_exec", { command });
},

// createFileReadTool (第 53 行)
execute: async ({ path }) => {
  if (!isTauri) return { error: "Not in Tauri environment" };
  return invoke("file_read", { path });
},

// createFileWriteTool (第 74 行)
execute: async ({ path, content }) => {
  if (!isTauri) return { error: "Not in Tauri environment" };
  return invoke("file_write", { path, content });
},

// createReadSkillTool (第 238 行)
execute: async ({ name }) => {
  if (!isTauri) return { error: "Not in Tauri environment" };
  return invoke("file_read", { path: `~/.envoy/brains/${username}/skills/${name}.md` });
},
```

## 详细整改方案

### 步骤 1：创建 `src/lib/tauri.ts` 共享模块

```typescript
// src/lib/tauri.ts
import { invoke } from "@tauri-apps/api/core";

/**
 * 检测当前是否运行在 Tauri 桌面环境中。
 * 基于 Tauri 内部注入的全局对象判断。
 */
export const isTauri = "__TAURI_INTERNALS__" in window;

/**
 * 安全调用 Tauri command。
 * 在非 Tauri 环境中静默返回 undefined，不会抛异常。
 *
 * @param cmd - Tauri command 名称（如 "shell_exec"）
 * @param args - 传递给 command 的参数对象
 * @returns Tauri command 返回值，或非 Tauri 环境中返回 undefined
 */
export function safeInvoke<T = void>(
  cmd: string,
  args: Record<string, unknown>,
): Promise<T | undefined> {
  if (!isTauri) return Promise.resolve(undefined);
  return invoke<T>(cmd, args);
}

/**
 * 要求必须在 Tauri 环境中执行的操作。
 * 在非 Tauri 环境中返回标准错误对象。
 *
 * @param action - 返回 Tauri invoke Promise 的函数
 * @returns 执行结果或 { error: "Not in Tauri environment" }
 */
export async function requireTauri<T>(
  action: () => Promise<T>,
): Promise<T | { error: string }> {
  if (!isTauri) return { error: "Not in Tauri environment" };
  return action();
}
```

### 步骤 2：更新 `src/composables/useTeamClient.ts`

```typescript
// 删除第 1 行的 invoke import（仅 safeInvoke 使用）
// 删除第 13-18 行的 isTauri 和 safeInvoke 定义

// 新增导入
import { isTauri, safeInvoke } from "../lib/tauri";

// 所有 safeInvoke 调用无需修改，签名兼容：
safeInvoke("save_message", { myId, peerId, message: item });           // 第 63 行 — 不变
const all = await safeInvoke("load_all_history", { myId });            // 第 76 行 — 不变
safeInvoke("export_history", { myId, peerId, targetPath });            // 第 311 行 — 不变
safeInvoke("importHistory", { myId, peerId, sourcePath });             // 第 315 行 — 不变
safeInvoke("load_history", { myId, peerId });                          // 第 317 行 — 不变
safeInvoke("delete_history", { myId, peerId });                        // 第 327 行 — 不变

// isTauri 使用也不变：
if (!isTauri) { ... }                                                  // 第 261 行 — 不变
```

### 步骤 3：更新 `src/agent/tools.ts`

```typescript
// 删除第 4 行的 isTauri 定义
// 删除第 1 行的 invoke import

// 新增导入
import { requireTauri } from "../lib/tauri";
import { invoke } from "@tauri-apps/api/core";  // 仍需保留 invoke 用于 requireTauri 内部

// 简化后的工具定义：
export function createShellTool(): AgentTool {
  return {
    name: "shell",
    description: "执行 shell 命令并返回输出",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "要执行的 shell 命令" },
      },
      required: ["command"],
    },
    execute: async ({ command }) =>
      requireTauri(() => invoke("shell_exec", { command })),
  };
}

export function createFileReadTool(): AgentTool {
  return {
    name: "file_read",
    description: "读取本地文件内容",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径（~ 开头表示用户 home 目录）" },
      },
      required: ["path"],
    },
    execute: async ({ path }) =>
      requireTauri(() => invoke("file_read", { path })),
  };
}

export function createFileWriteTool(): AgentTool {
  return {
    name: "file_write",
    description: "写入内容到本地文件",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径" },
        content: { type: "string", description: "要写入的内容" },
      },
      required: ["path", "content"],
    },
    execute: async ({ path, content }) =>
      requireTauri(() => invoke("file_write", { path, content })),
  };
}

export function createReadSkillTool(username: string): AgentTool {
  return {
    name: "read_skill",
    description: "读取指定技能的完整内容",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "技能名称" },
      },
      required: ["name"],
    },
    execute: async ({ name }) =>
      requireTauri(() =>
        invoke("file_read", { path: `~/.envoy/brains/${username}/skills/${name}.md` })
      ),
  };
}

// createUploadResourceTool 也使用 isTauri（第 117 行），更新为：
import { isTauri } from "../lib/tauri";

export function createUploadResourceTool(ctx: { ... }): AgentTool {
  return {
    // ...
    execute: async ({ path: filePath }) => {
      if (!isTauri) return { error: "Not in Tauri environment" };
      // ... 其余逻辑不变
    },
  };
}
```

### 步骤 4：更新 `src/composables/useAgent.ts`

`useAgent.ts` 第 27 行也有 `catch (e: any)` 模式，虽然不是 isTauri 重复，但可以在同一次重构中顺便修复：

```typescript
// 当前
} catch (e: any) {
  error.value = e.message || String(e);

// 改为
} catch (e: unknown) {
  error.value = e instanceof Error ? e.message : String(e);
```

## 文件变更总结

| 文件 | 变更 |
|------|------|
| `src/lib/tauri.ts` | **新增** — 共享模块（`isTauri`, `safeInvoke`, `requireTauri`） |
| `src/composables/useTeamClient.ts` | 删除 6 行本地定义，添加 1 行 import |
| `src/agent/tools.ts` | 删除 1 行本地定义，添加 1 行 import，简化 4 个工具函数 |

## 验证方法

1. **导入验证**：
   ```bash
   grep -rn "isTauri.*=" src/ --include="*.ts"
   ```
   确认只有 `src/lib/tauri.ts` 中有定义，其他文件都是 import。

2. **功能回归**：
   - **Tauri 桌面环境**：启动 `npm run tauri:dev`，验证所有 Tauri 命令（shell_exec, file_read, file_write, save_message 等）正常执行
   - **浏览器环境**：运行 `npm run dev`，验证所有 Tauri 命令静默跳过，无报错
   - **Agent 任务执行**：在 Tauri 环境中触发 Member 任务，验证 shell/file 工具正常

3. **错误场景**：
   - 在浏览器中触发 Agent 任务，验证返回 `{ error: "Not in Tauri environment" }`
   - 验证 `safeInvoke` 在浏览器中返回 `undefined`，不抛异常

4. **类型检查**：
   ```bash
   npx vue-tsc --noEmit
   ```
   确认 `safeInvoke<T>` 的泛型参数正确传递，消费方无需类型断言。
