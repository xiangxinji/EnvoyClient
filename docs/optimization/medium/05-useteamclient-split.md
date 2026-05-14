# 05 - useTeamClient 职责过重

## 问题描述

`src/composables/useTeamClient.ts` 是项目中最大的 composable（357 行），承担了至少 4 个不同领域的职责：

1. **连接管理** — WebSocket 连接/断连、状态追踪、自动重连、`onUnmounted` 清理
2. **消息路由** — 消息收发、未读计数、历史加载、会话管理（增/删/导入/导出）
3. **任务执行** — Agent 工具创建、ReAct 循环启动、任务结果提交、Leader review 逻辑
4. **AI 集成** — 在 `doing()` handler 中创建 `useAI()` 实例，调用 `reviewTaskResult()`

这种"上帝对象"模式导致：
- 难以独立测试每个关注点
- 修改消息逻辑可能意外影响任务执行
- 新开发者需要理解整个文件才能定位功能
- 复用困难（例如只想用消息功能，却被迫引入连接管理）

## 影响范围

- **直接文件**: `src/composables/useTeamClient.ts`
- **消费方**: `src/composables/teamClientContext.ts`（全局注入）
- **下游组件**: `ChatView.vue`, `ChatPanel.vue`, `MemberSidebar.vue`, `TaskCenterView.vue`, `TaskDispatchPanel.vue`, `RoleSelect.vue`
- **关联 composable**: `useAgent.ts`, `useAI.ts`

## 涉及代码

### 当前结构（357 行）

```
useTeamClient.ts
├── L1-18:   isTauri + safeInvoke 定义
├── L20-28:  类型定义（ConnectionStatus, TeamClientOptions）
├── L30-38:  初始化（创建 client、myId、teamName）
├── L40-44:  ref 状态（status, configuredMembers, onlineIds, messages, unreadCounts）
├── L46-53:  computed members
├── L55-65:  getConversation / addToConversation  ← 消息
├── L67-72:  incrementUnread / markRead            ← 消息
├── L74-85:  loadHistory                           ← 消息
├── L87-104: loadConfiguredMembers                 ← 连接
├── L106-109: client.on("connected")              ← 连接
├── L112-118: client.on("disconnected/reconnecting") ← 连接
├── L120-148: client.on("message")                ← 消息路由
├── L150-190: handleTaskUpdate                    ← 消息/任务
├── L192:     client.on("task")                   ← 连接
├── L194-201: connect / disconnect                ← 连接
├── L203-215: sendChat / dispatchTask             ← 消息
├── L226-308: client.doing() handler              ← 任务执行 + AI
├── L310-319: exportHistory / importHistory       ← 消息
├── L322-332: clearConversation                   ← 消息
├── L334-336: onUnmounted                         ← 连接
└── L338-357: return 接口
```

## 详细整改方案

### 步骤 1：创建 `src/composables/useConnection.ts`

负责 WebSocket 连接的建立、断开、状态追踪和清理。

```typescript
// src/composables/useConnection.ts
import { ref, onUnmounted } from "vue";
import { Leader } from "../../envoy/packages/teams/leader.js";
import { Member } from "../../envoy/packages/teams/member.js";
import type { ClientOptions } from "@envoy/client";
import type { MemberInfo } from "../types";
import { managerFetch } from "../api";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface ConnectionClientOptions extends ClientOptions {
  teamName: string;
}

export function useConnection(
  role: "leader" | "member",
  options: ConnectionClientOptions,
) {
  const clientOpts = { ...options, autoSendResult: false };
  const client = role === "leader"
    ? new Leader(clientOpts)
    : new Member(clientOpts);
  const teamName = options.teamName;
  const myId = options.id;

  const status = ref<ConnectionStatus>("disconnected");
  const configuredMembers = ref<MemberInfo[]>([]);
  const onlineIds = ref<Set<string>>(new Set());

  const members = computed<MemberInfo[]>(() => {
    return configuredMembers.value
      .map((m) => ({
        ...m,
        status: onlineIds.value.has(m.id) ? "online" as const : "offline" as const,
      }))
      .filter((m) => m.id !== myId);
  });

  async function loadConfiguredMembers() {
    try {
      const res = await managerFetch(
        `/api/teams/${encodeURIComponent(teamName)}/configured-members`
      );
      const data = await res.json() as {
        leader: string;
        members: { username: string; responsibilities?: string }[];
      };
      const list: MemberInfo[] = [
        { id: data.leader, role: "leader", status: "offline" },
        ...data.members.map((m) => ({
          id: m.username,
          role: "member" as const,
          status: "offline" as const,
          responsibilities: m.responsibilities,
        })),
      ];
      configuredMembers.value = list;
    } catch {
      // API unavailable, fallback to WS-only members
    }
  }

  // 注册连接事件
  client.on("connected", () => {
    status.value = "connected";
    loadConfiguredMembers();
  });

  client.on("disconnected", () => {
    status.value = "disconnected";
  });

  client.on("reconnecting", () => {
    status.value = "reconnecting";
  });

  function connect() {
    status.value = "connecting";
    return client.connect();
  }

  function disconnect() {
    return client.disconnect();
  }

  onUnmounted(() => {
    client.disconnect();
  });

  return {
    client,
    myId,
    role,
    teamName,
    status,
    configuredMembers,
    onlineIds,
    members,
    connect,
    disconnect,
  };
}
```

### 步骤 2：创建 `src/composables/useMessages.ts`

负责消息的收发、存储、未读计数、历史加载和导入导出。

```typescript
// src/composables/useMessages.ts
import { ref } from "vue";
import type { Message } from "@envoy/core";
import type { MemberInfo, TimelineItem, ChatMessage, TaskMessage, TaskResource } from "../types";
import { safeInvoke } from "../lib/tauri";
import { managerPost } from "../api";

export function useMessages(
  myId: string,
  teamName: string,
  configuredMembers: Ref<MemberInfo[]>,
  onlineIds: Ref<Set<string>>,
) {
  const messages = ref<Map<string, TimelineItem[]>>(new Map());
  const unreadCounts = ref<Map<string, number>>(new Map());

  function getConversation(peerId: string): TimelineItem[] {
    return messages.value.get(peerId) ?? [];
  }

  function addToConversation(peerId: string, item: TimelineItem) {
    const conv = messages.value.get(peerId) ?? [];
    conv.push(item);
    messages.value.set(peerId, conv);
    safeInvoke("save_message", { myId, peerId, message: item });
  }

  function incrementUnread(peerId: string) {
    unreadCounts.value.set(
      peerId,
      (unreadCounts.value.get(peerId) ?? 0) + 1,
    );
  }

  function markRead(peerId: string) {
    unreadCounts.value.set(peerId, 0);
  }

  async function loadHistory() {
    try {
      const all = await safeInvoke("load_all_history", { myId }) as
        Record<string, TimelineItem[]> | undefined;
      if (all) {
        for (const [peerId, items] of Object.entries(all)) {
          messages.value.set(peerId, items);
        }
      }
    } catch {
      // no history files yet
    }
  }

  function handleIncomingMessage(msg: Message) {
    if (msg.type === "message" && msg.subtype === "chat") {
      const chatMsg: ChatMessage = {
        type: "chat",
        id: msg.id,
        from: msg.from,
        to: msg.to,
        text: (msg.payload as { text: string }).text,
        timestamp: msg.timestamp,
        mine: msg.from === myId,
      };
      const peerId = msg.from === myId ? msg.to : msg.from;
      addToConversation(peerId, chatMsg);
      if (msg.from !== myId) {
        incrementUnread(peerId);
      }
      return true; // handled
    }
    return false; // not handled
  }

  function handleTaskUpdate(task: {
    id: string;
    createBy: string;
    content: string;
    status: string;
    resources: TaskResource[];
    subscribe?: string[];
  }) {
    const taskMsg: TaskMessage = {
      type: "task",
      id: `task-${task.id}`,
      taskId: task.id,
      from: task.createBy,
      content: task.content,
      status: task.status as TaskMessage["status"],
      resources: task.resources,
      subscribe: task.subscribe,
      timestamp: Date.now(),
    };

    let updated = false;
    for (const [peerId, items] of messages.value) {
      const idx = items.findIndex(
        (t) => t.type === "task" && "taskId" in t && t.taskId === task.id,
      );
      if (idx >= 0) {
        items[idx] = taskMsg;
        messages.value.set(peerId, [...items]);
        safeInvoke("save_message", { myId, peerId, message: taskMsg });
        updated = true;
      }
    }

    if (!updated) {
      const targetPeers = task.createBy === myId
        ? (task.subscribe ?? [])
        : [task.createBy];
      for (const peerId of targetPeers) {
        addToConversation(peerId, taskMsg);
        incrementUnread(peerId);
      }
    }
  }

  function sendChat(targetId: string, text: string) {
    const chatMsg: ChatMessage = {
      type: "chat",
      id: `${Date.now()}-local`,
      from: myId,
      to: targetId,
      text,
      timestamp: Date.now(),
      mine: true,
    };
    addToConversation(targetId, chatMsg);
    managerPost("/api/messages", { from: myId, to: targetId, text }, { team: teamName });
  }

  async function exportHistory(peerId: string, targetPath: string) {
    await safeInvoke("export_history", { myId, peerId, targetPath });
  }

  async function importHistory(peerId: string, sourcePath: string) {
    await safeInvoke("importHistory", { myId, peerId, sourcePath });
    const items = await safeInvoke("load_history", { myId, peerId }) as
      TimelineItem[] | undefined;
    if (items) {
      messages.value.set(peerId, items);
    }
  }

  async function clearConversation(peerId: string) {
    const newMessages = new Map(messages.value);
    newMessages.delete(peerId);
    messages.value = newMessages;

    const newUnread = new Map(unreadCounts.value);
    newUnread.delete(peerId);
    unreadCounts.value = newUnread;

    await safeInvoke("delete_history", { myId, peerId });
  }

  return {
    messages,
    unreadCounts,
    getConversation,
    addToConversation,
    incrementUnread,
    markRead,
    loadHistory,
    handleIncomingMessage,
    handleTaskUpdate,
    sendChat,
    exportHistory,
    importHistory,
    clearConversation,
  };
}
```

### 步骤 3：创建 `src/composables/useTaskExecution.ts`

负责 Agent 任务执行、Leader 审查和结果提交。

```typescript
// src/composables/useTaskExecution.ts
import { useAgent } from "./useAgent";
import { useAI } from "./useAI";
import {
  getDefaultTools,
  createUploadResourceTool,
  createQueryResourcesTool,
  createReadResourceTool,
  createReadSkillTool,
} from "../agent/tools";
import { safeInvoke } from "../lib/tauri";
import { managerPost } from "../api";

interface TaskExecutionContext {
  role: "leader" | "member";
  myId: string;
  teamName: string;
}

export function useTaskExecution(ctx: TaskExecutionContext) {
  const agent = useAgent();

  function postToManager(path: string, body: Record<string, unknown>) {
    return managerPost(path, body, { team: ctx.teamName });
  }

  function registerHandler(
    client: { doing: (handler: (task: any) => Promise<any>) => void },
  ) {
    client.doing(async (clientTask) => {
      const taskId = clientTask.serverTask.id;
      const taskContent = clientTask.serverTask.content;
      const taskStatus = clientTask.serverTask.status;

      // Leader 审查模式
      if (ctx.role === "leader" && taskStatus === "reviewing") {
        return await handleLeaderReview(clientTask, taskId, taskContent);
      }

      // Member 执行模式
      return await handleMemberExecution(clientTask, taskId, taskContent);
    });
  }

  async function handleLeaderReview(
    clientTask: any,
    taskId: string,
    taskContent: string,
  ) {
    const task = clientTask.serverTask;
    const memberResults = task.resources.filter(
      (r: any) => r.type === "client-result" && r.attempt === task.attempt,
    );

    try {
      const ai = useAI();
      const reviewResult = await ai.reviewTaskResult(taskContent, memberResults);

      postToManager(`/api/tasks/${taskId}/result`, {
        from: ctx.myId,
        success: reviewResult.success,
        data: { review: reviewResult.summary, ...reviewResult },
      });
      return reviewResult;
    } catch (e) {
      postToManager(`/api/tasks/${taskId}/result`, {
        from: ctx.myId,
        success: false,
        error: `Leader review failed: ${String(e)}`,
      });
      return { error: String(e) };
    }
  }

  async function handleMemberExecution(
    clientTask: any,
    taskId: string,
    taskContent: string,
  ) {
    const isTauri = "__TAURI_INTERNALS__" in window;
    if (!isTauri) {
      const result = { taskId, note: "browser mode, no agent tools" };
      postToManager(`/api/tasks/${taskId}/result`, {
        from: ctx.myId,
        success: true,
        data: result,
      });
      return result;
    }

    try {
      const uploadTool = createUploadResourceTool({
        teamName: ctx.teamName,
        taskId,
        myId: ctx.myId,
      });
      const queryResTool = createQueryResourcesTool({ teamName: ctx.teamName });
      const readResTool = createReadResourceTool({ teamName: ctx.teamName });
      const readSkillTool = createReadSkillTool(ctx.myId);
      const tools = [
        ...getDefaultTools(),
        uploadTool,
        queryResTool,
        readResTool,
        readSkillTool,
      ];
      const workspacePath = `~/.envoy/workspace/${ctx.myId}`;

      let skillCatalog: string | undefined;
      try {
        const catalogResult = await safeInvoke("load_skill_catalog", {
          username: ctx.myId,
        }) as any;
        const skills = catalogResult?.skills as
          Array<{ name: string; description: string; filename: string }> | undefined;
        if (skills && skills.length > 0) {
          const lines = skills.map((s) => `- ${s.name}: ${s.description}`);
          skillCatalog =
            `你可以使用以下技能：\n${lines.join("\n")}\n需要使用某个技能时，调用 read_skill 工具读取完整内容。`;
        }
      } catch {
        // skills unavailable, continue without
      }

      const agentResult = await agent.runAgent(
        taskContent,
        tools,
        workspacePath,
        skillCatalog,
      );

      let parsed;
      try {
        parsed = JSON.parse(agentResult.result);
      } catch {
        parsed = { result: agentResult.result };
      }

      postToManager(`/api/tasks/${taskId}/result`, {
        from: ctx.myId,
        success: true,
        data: parsed,
        trace: agentResult.trace,
      });
      return parsed;
    } catch (e) {
      const error = String(e);
      postToManager(`/api/tasks/${taskId}/result`, {
        from: ctx.myId,
        success: false,
        error,
      });
      return { error };
    }
  }

  return {
    agent,
    registerHandler,
  };
}
```

### 步骤 4：重构 `useTeamClient.ts` 为组合入口

```typescript
// src/composables/useTeamClient.ts（重构后，约 60 行）
import type { ClientOptions } from "@envoy/client";
import { useConnection } from "./useConnection";
import { useMessages } from "./useMessages";
import { useTaskExecution } from "./useTaskExecution";
import { managerPost } from "../api";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface TeamClientOptions extends ClientOptions {
  teamName: string;
}

export function useTeamClient(
  role: "leader" | "member",
  options: TeamClientOptions,
) {
  // 1. 连接层
  const conn = useConnection(role, options);

  // 2. 消息层
  const msg = useMessages(
    conn.myId,
    conn.teamName,
    conn.configuredMembers,
    conn.onlineIds,
  );

  // 3. 任务执行层
  const taskExec = useTaskExecution({
    role,
    myId: conn.myId,
    teamName: conn.teamName,
  });

  // ─── 胶水代码：连接事件桥接到消息层 ───

  conn.client.on("connected", () => {
    msg.loadHistory();
  });

  conn.client.on("message", (msgObj: any) => {
    // team:members 消息由连接层处理
    if (msgObj.type === "notify" && msgObj.subtype === "team:members") {
      const payload = msgObj.payload as { members: any[] };
      conn.onlineIds.value = new Set(payload.members.map((m) => m.id));
      if (conn.configuredMembers.value.length === 0) {
        conn.configuredMembers.value = payload.members.map((m: any) => ({
          ...m,
          status: "online" as const,
        }));
      }
      return;
    }
    msg.handleIncomingMessage(msgObj);
  });

  conn.client.on("task", msg.handleTaskUpdate);

  // 注册任务执行 handler
  taskExec.registerHandler(conn.client);

  // ─── 暴露统一接口 ───

  function dispatchTask(targetIds: string[], content: string) {
    managerPost("/api/tasks", {
      from: conn.myId,
      content,
      subscribe: targetIds,
      mode: "serial",
    }, { team: conn.teamName });
  }

  return {
    myId: conn.myId,
    role,
    teamName: conn.teamName,
    status: conn.status,
    members: conn.members,
    messages: msg.messages,
    unreadCounts: msg.unreadCounts,
    connect: conn.connect,
    disconnect: conn.disconnect,
    sendChat: msg.sendChat,
    dispatchTask,
    getConversation: msg.getConversation,
    incrementUnread: msg.incrementUnread,
    markRead: msg.markRead,
    clearConversation: msg.clearConversation,
    exportHistory: msg.exportHistory,
    importHistory: msg.importHistory,
  };
}
```

## 验证方法

1. **功能回归测试**：
   - 登录 -> 选择团队 -> 连接成功（`useConnection`）
   - 发送聊天消息 -> 对方收到 -> 未读计数增加（`useMessages`）
   - Leader 分派任务 -> Member 收到 -> Agent 执行 -> 结果提交（`useTaskExecution`）
   - Leader review 任务 -> AI 分析 -> 结果回传

2. **接口兼容性验证**：
   - `teamClientContext.ts` 的 `TeamClientContext` 类型不变
   - 所有下游组件（`ChatPanel.vue`, `MemberSidebar.vue` 等）无需修改
   - `RoleSelect.vue` 调用 `connect()` 仍正常工作

3. **单元测试建议**：
   - 为 `useConnection` 编写 mock WebSocket 测试
   - 为 `useMessages` 编写消息收发测试（不依赖真实连接）
   - 为 `useTaskExecution` 编写 mock Agent 测试

4. **代码量验证**：
   - `useTeamClient.ts` 从 357 行降至约 60 行
   - 新增三个文件各约 80-120 行，职责清晰
