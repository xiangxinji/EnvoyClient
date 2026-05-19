# 10 - taskCount 遍历性能差

## 问题描述

`MemberSidebar.vue` 中的 `taskCount` computed 遍历所有对话的所有消息来计算任务数量，O(N*M) 复杂度。

## 涉及代码

- `src/components/MemberSidebar.vue:17-29`

## 详细整改方案

### 方案：维护独立 taskCount ref，增量更新

#### 步骤 1：在 useTeamClient 中添加 taskCount ref

```typescript
const taskCount = ref(0);

function handleTaskUpdate(update: TaskMessage) {
  // ... 现有逻辑 ...
  taskCount.value++;
}
```

#### 步骤 2：通过 provide/inject 传递

```typescript
return {
  // ... 现有返回 ...
  taskCount: readonly(taskCount),
};
```

#### 步骤 3：MemberSidebar 直接使用

```typescript
const { taskCount } = useTeamClientFromContext();
```

## 验证方法

1. 收到任务更新时 taskCount 正确递增
2. Vue DevTools 确认无不必要的重算
