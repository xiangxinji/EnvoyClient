# 14 - ChatPanel 组件过大

## 问题描述

`ChatPanel.vue` 420+ 行，混合聊天消息、AI 建议、任务分派逻辑。

## 涉及代码

- `src/components/ChatPanel.vue`

## 详细整改方案

### 拆分结构

```
ChatPanel.vue (~150 行)
├── useChatAI.ts       — AI 建议/规划 composable
├── AiSuggestion.vue   — AI 建议回复 UI 子组件
└── MessageBubble.vue  — 已有
```

#### useChatAI.ts

```typescript
export function useChatAI() {
  const suggestion = ref("");
  const isStreaming = ref(false);

  async function requestSuggestion(messages: ChatMessage[]) { /* ... */ }
  function clearSuggestion() { suggestion.value = ""; }

  return { suggestion, isStreaming, requestSuggestion, clearSuggestion };
}
```

#### AiSuggestion.vue

```vue
<script setup lang="ts">
defineProps<{ text: string; loading: boolean }>();
defineEmits<{ accept: [text: string]; dismiss: [] }>();
</script>
```

## 验证方法

1. AI 建议功能正常
2. ChatPanel.vue 降到 200 行以内
