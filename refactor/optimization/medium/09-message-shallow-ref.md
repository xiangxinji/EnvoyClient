# 09 - 消息存储响应式开销

## 问题描述

`src/composables/useTeamClient.ts` 第 43 行使用 `ref<Map<string, TimelineItem[]>>` 存储所有对话消息：

```typescript
const messages = ref<Map<string, TimelineItem[]>>(new Map());
```

`ref()` 会对整个值进行深度响应式代理（reactive proxy），这意味着：

1. **每次 `set()` 触发全量更新**：当调用 `messages.value.set(peerId, conv)` 时，Vue 会深度追踪 Map 和所有内部数组，每次更新都触发依赖该 ref 的所有 watcher/computed 重新计算
2. **消息数组增长导致代理开销递增**：随着聊天消息增多，每个 `TimelineItem[]` 数组越大，Vue 代理的深度追踪开销越大
3. **任务更新遍历开销**：`handleTaskUpdate`（第 170-179 行）遍历所有对话查找任务并替换，每次都会创建新数组 `[...items]`，触发不必要的响应式更新

实际上，消息数据是"追加为主"的不可变列表，不需要 Vue 深度追踪内部属性的变化。

## 影响范围

- **直接文件**: `src/composables/useTeamClient.ts:43`
- **消费方**:
  - `ChatPanel.vue` — 通过 `getConversation()` 读取
  - `MemberSidebar.vue` — 通过 `messages.value.values()` 遍历计算 `taskCount`
  - `TaskCenterView.vue` — 通过 `getConversation()` 读取

## 涉及代码

### 当前实现（useTeamClient.ts）

```typescript
// 第 43 行 — 深度响应式
const messages = ref<Map<string, TimelineItem[]>>(new Map());

// 第 59-64 行 — 每次追加消息都触发全量更新
function addToConversation(peerId: string, item: TimelineItem) {
  const conv = messages.value.get(peerId) ?? [];
  conv.push(item);
  messages.value.set(peerId, conv);  // 触发 Map 代理的 set handler
  safeInvoke("save_message", { myId, peerId, message: item });
}

// 第 170-179 行 — 任务更新时遍历所有对话
for (const [peerId, items] of messages.value) {
  const idx = items.findIndex((t) => t.type === "task" && "taskId" in t && t.taskId === task.id);
  if (idx >= 0) {
    items[idx] = taskMsg;
    messages.value.set(peerId, [...items]);  // 创建新数组 + 触发更新
  }
}

// 第 322-325 行 — 清除对话
async function clearConversation(peerId: string) {
  const newMessages = new Map(messages.value);  // 复制整个 Map
  newMessages.delete(peerId);
  messages.value = newMessages;  // 替换整个 ref 值
}
```

### 消费方使用方式

```typescript
// ChatPanel.vue — 读取某个 peer 的消息
const conversation = computed<TimelineItem[]>(() => {
  return getConversation(props.peerId);  // messages.value.get(peerId)
});

// MemberSidebar.vue — 遍历所有对话计算任务数
const taskCount = computed(() => {
  let count = 0;
  for (const items of messages.value.values()) {  // 遍历所有对话
    for (const item of items) {                     // 遍历所有消息
      if (item.type === "task" && !seen.has(item.taskId)) {
        count++;
      }
    }
  }
  return count;
});
```

## 详细整改方案

### 步骤 1：将 `ref` 替换为 `shallowRef`

```typescript
import { shallowRef, triggerRef } from "vue";

// 修改前
const messages = ref<Map<string, TimelineItem[]>>(new Map());

// 修改后
const messages = shallowRef<Map<string, TimelineItem[]>>(new Map());
```

`shallowRef` 只追踪 `.value` 的引用变化，不会深度代理 Map 内部的数组。这在语义上完全正确——消息是追加式的不可变数据，我们只关心"Map 变了"，不关心"Map 里某个数组的某个元素变了"。

### 步骤 2：使用 `triggerRef` 通知更新

将所有直接修改内部数据的地方改为替换 Map 引用 + `triggerRef`。

```typescript
import { shallowRef, triggerRef } from "vue";

const messages = shallowRef<Map<string, TimelineItem[]>>(new Map());

function addToConversation(peerId: string, item: TimelineItem) {
  const map = messages.value;
  const conv = map.get(peerId) ?? [];
  conv.push(item);
  map.set(peerId, conv);
  triggerRef(messages);  // 手动触发依赖更新
  safeInvoke("save_message", { myId, peerId, message: item });
}
```

**性能收益**：`triggerRef` 是 O(1) 操作（通知 watchers），而 Vue 深度代理的 set handler 需要 O(n) 递归追踪。

### 步骤 3：优化 `handleTaskUpdate` 避免不必要的数组复制

```typescript
function handleTaskUpdate(task: { ... }) {
  const taskMsg: TaskMessage = { ... };
  let updated = false;
  const map = messages.value;

  for (const [peerId, items] of map) {
    const idx = items.findIndex(
      (t) => t.type === "task" && "taskId" in t && t.taskId === task.id,
    );
    if (idx >= 0) {
      items[idx] = taskMsg;  // 就地修改（shallowRef 不追踪内部）
      updated = true;
    }
  }

  if (updated) {
    triggerRef(messages);  // 一次性触发更新
    // 选择性持久化：只保存修改过的对话
    for (const [peerId, items] of map) {
      if (items.some((t) => t.type === "task" && "taskId" in t && t.taskId === task.id)) {
        safeInvoke("save_message", { myId, peerId, message: taskMsg });
      }
    }
    return;
  }

  // 新任务
  const targetPeers = task.createBy === myId
    ? (task.subscribe ?? [])
    : [task.createBy];
  for (const peerId of targetPeers) {
    addToConversation(peerId, taskMsg);
    incrementUnread(peerId);
  }
}
```

### 步骤 4：优化 `loadHistory`（批量加载）

```typescript
async function loadHistory() {
  try {
    const all = await safeInvoke("load_all_history", { myId }) as
      Record<string, TimelineItem[]> | undefined;
    if (all) {
      const map = new Map(messages.value);
      for (const [peerId, items] of Object.entries(all)) {
        map.set(peerId, items);
      }
      messages.value = map;  // shallowRef 的 .value 赋值自动触发更新
    }
  } catch {
    // no history files yet
  }
}
```

### 步骤 5：优化 `clearConversation`

```typescript
async function clearConversation(peerId: string) {
  const map = new Map(messages.value);
  map.delete(peerId);
  messages.value = map;  // 赋值新 Map 自动触发

  const unreadMap = new Map(unreadCounts.value);
  unreadMap.delete(peerId);
  unreadCounts.value = unreadMap;

  await safeInvoke("delete_history", { myId, peerId });
}
```

### 步骤 6：同样优化 `unreadCounts`

```typescript
// 修改前
const unreadCounts = ref<Map<string, number>>(new Map());

// 修改后
const unreadCounts = shallowRef<Map<string, number>>(new Map());

function incrementUnread(peerId: string) {
  const map = unreadCounts.value;
  map.set(peerId, (map.get(peerId) ?? 0) + 1);
  triggerRef(unreadCounts);
}

function markRead(peerId: string) {
  const map = unreadCounts.value;
  if (map.get(peerId) !== 0) {
    map.set(peerId, 0);
    triggerRef(unreadCounts);
  }
}
```

## 完整变更对比

### 修改前（useTeamClient.ts 相关部分）

```typescript
const messages = ref<Map<string, TimelineItem[]>>(new Map());
const unreadCounts = ref<Map<string, number>>(new Map());

function addToConversation(peerId: string, item: TimelineItem) {
  const conv = messages.value.get(peerId) ?? [];
  conv.push(item);
  messages.value.set(peerId, conv);
  safeInvoke("save_message", { myId, peerId, message: item });
}

function incrementUnread(peerId: string) {
  unreadCounts.value.set(peerId, (unreadCounts.value.get(peerId) ?? 0) + 1);
}

function markRead(peerId: string) {
  unreadCounts.value.set(peerId, 0);
}
```

### 修改后

```typescript
const messages = shallowRef<Map<string, TimelineItem[]>>(new Map());
const unreadCounts = shallowRef<Map<string, number>>(new Map());

function addToConversation(peerId: string, item: TimelineItem) {
  const map = messages.value;
  const conv = map.get(peerId) ?? [];
  conv.push(item);
  map.set(peerId, conv);
  triggerRef(messages);
  safeInvoke("save_message", { myId, peerId, message: item });
}

function incrementUnread(peerId: string) {
  const map = unreadCounts.value;
  map.set(peerId, (map.get(peerId) ?? 0) + 1);
  triggerRef(unreadCounts);
}

function markRead(peerId: string) {
  const map = unreadCounts.value;
  if (map.get(peerId) !== 0) {
    map.set(peerId, 0);
    triggerRef(unreadCounts);
  }
}
```

## 验证方法

1. **功能回归**：
   - 发送消息 -> 对方收到 -> 消息列表实时更新
   - 接收消息 -> 未读计数增加 -> 点击后归零
   - 任务更新 -> 任务卡片状态更新
   - 清除对话 -> 消息消失
   - 导入/导出历史 -> 数据正确

2. **性能对比**：
   ```typescript
   // 在 DevTools Performance 面板中对比：
   // 1. 发送 100 条消息的响应时间
   // 2. 大量消息（1000+）时的渲染帧率
   ```
   预期改善：
   - `addToConversation` 从 O(n) 响应式追踪变为 O(1) `triggerRef`
   - 大消息量场景下 UI 不卡顿

3. **Vue DevTools 检查**：
   - 打开 Vue DevTools，确认 `messages` 和 `unreadCounts` 仍显示为响应式
   - 修改值后组件正确重渲染

4. **内存检查**：
   - 使用 Chrome Memory 面板，对比 shallowRef vs ref 在 1000 条消息下的内存占用
   - 预期减少约 20-30%（无深层 Proxy 代理开销）
