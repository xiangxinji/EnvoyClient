# EnvoyClient 项目规范

## Composable 使用规范

### useToast — Toast 提示

**文件**: `src/composables/useToast.ts`

所有需要 Toast 提示的组件必须使用 `useToast` composable，禁止手动管理 `toastVisible/toastMessage/toastType` 状态。

```ts
import { useToast } from "../../composables/useToast";

const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();
```

**模板用法**:
```vue
<Toast :visible="toastVisible" :message="toastMessage" :type="toastType" @done="hideToast" />
```

**调用方式**:
```ts
showToast("操作成功", "success");
showToast("操作失败", "error");
showToast("提示信息", "info");
```

### useConfirm — 确认对话框

**文件**: `src/composables/useConfirm.ts`

所有需要确认对话框的组件必须使用 `useConfirm` composable，禁止手动管理 `confirmVisible/confirmTitle/confirmMessage/confirmDanger/pendingAction` 状态。

```ts
import { useConfirm } from "../../composables/useConfirm";

const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();
```

**模板用法**:
```vue
<ConfirmDialog
  :visible="confirmVisible"
  :title="confirmTitle"
  :message="confirmMessage"
  :danger="confirmDanger"
  @confirm="handleConfirm"
  @cancel="handleCancel"
/>
```

**调用方式**:
```ts
// 普通确认
showConfirm("确认标题", "确认消息", () => {
  // 确认后执行的操作
});

// 危险操作确认（红色按钮）
showConfirm("删除确认", "确定要删除吗？", () => {
  // 删除操作
}, true);
```

## 代码结构原则

1. **禁止重复状态管理**: 如果多个组件存在相同的状态管理模式（如 Toast、Confirm），必须提取为 composable 复用
2. **Composable 命名**: 以 `use` 前缀命名，文件放在 `src/composables/` 目录
3. **组件职责单一**: 组件中不应包含可提取的通用逻辑，如 Toast 显示、确认弹窗等
