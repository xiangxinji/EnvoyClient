## Context

Client 前端（`src/`）有 274 条硬编码中文字符串分布在 24 个文件中（17 `.vue` + 7 `.ts`），无任何国际化基础设施。项目使用 Vue 3.5 + Composition API + Vite 6，已有 `useTheme` composable 作为 reactive state + localStorage 持久化的参考模式。

## Goals / Non-Goals

**Goals:**
- 安装 vue-i18n 并集成到 Vue 应用
- 将所有 Client 前端硬编码中文提取到翻译文件，支持简体中文和英文
- 提供语言切换 UI（SettingsPanel 中用 GlassSelect）
- 语言偏好持久化到 localStorage

**Non-Goals:**
- Manager 前端（`manager/web/`）国际化 — 不在本次范围
- Agent 工具描述（`src/agent/tools.ts`）翻译 — 保持中文不变，因为这些文本喂给 AI 模型
- 复数、日期、数字格式化 — 项目不需要
- 运行时动态加载语言包 — 只有 2 种语言，静态打包即可
- 后端 API 或 Tauri 命令变更

## Decisions

### 1. 使用 vue-i18n 官方库

**选择**: `vue-i18n` v10+（支持 Vue 3.5）

**替代方案**: 自研轻量 composable（`ref<Record<string, string>>` + 查找函数）

**理由**: vue-i18n 提供成熟的 `$t()` / `useI18n()` API、SFC 集成、TypeScript 类型提示、Vue DevTools 支持。项目只有 2 种语言，不需要额外配置 `@intlify/unplugin-vue-i18n` 等 Vite 插件，直接用 JSON 文件即可。

### 2. 翻译文件按功能域嵌套组织

**结构**:
```
src/i18n/
├── index.ts        ← createI18n() + useLocale()
├── zh-CN.json      ← { "common": {...}, "settings": {...}, ... }
└── en.json         ← 同结构
```

**功能域划分**:
- `common` — 通用文本（确认、取消、保存、加载中、是、否等）
- `role` — 登录页（RoleSelect）
- `chat` — 聊天面板（ChatPanel、MessageBubble）
- `task` — 任务相关（TaskCard、TaskDetailPanel、TaskCenterView、TaskDispatchPanel）
- `settings` — 设置面板（SettingsPanel）
- `notification` — 桌面通知文本
- `sidebar` — 侧边栏（MemberSidebar）
- `titlebar` — 标题栏（TitleBar）

**替代方案**: 扁平 key（`settings.title`）或按组件分文件

**理由**: 按功能域分组可读性好，嵌套结构让 key 有层级语义。按组件分文件会产生太多小文件（24 个），管理成本高。

### 3. useLocale() composable 封装

**模式**: 模仿 `useTheme.ts` — 模块级 `ref` 单例 + `localStorage` 持久化

```ts
// src/i18n/index.ts
export function useLocale() {
  return {
    locale: i18n.global.locale,   // WritableComputedRef<string>
    switchLocale(lang: string),    // 切换语言 + 持久化
    availableLocales: ['zh-CN', 'en']
  }
}
```

**理由**: 与项目现有 composable 模式一致。组件通过 `useI18n()` 获取 `t()` 函数，通过 `useLocale()` 获取切换能力，职责分离。

### 4. localStorage key 与默认值

- Key: `envoy-locale`
- 默认值: `zh-CN`（不跟随浏览器语言，保持简单）
- 读取逻辑: `localStorage.getItem('envoy-locale') ?? 'zh-CN'`

**理由**: 用户明确要求默认简体中文。不跟随浏览器语言可以避免意外行为。

### 5. 组件迁移策略：逐文件替换

在每个文件中：
- **Template**: `{{ $t('domain.key') }}` 替换硬编码文本
- **Script setup**: `const { t } = useI18n()` 获取 `t()` 函数
- **composable 中**: 同样使用 `useI18n()` 的 `t()` 函数

不在运行时动态切换 HTML `lang` 属性以外的 DOM 操作。vue-i18n 的响应式机制自动处理文本更新。

### 6. 任务状态标签统一

"等待中/执行中/审查中/已完成/失败" 当前在 3 个文件中重复定义。提取到 `task.status.*` key 后，统一使用 `t('task.status.running')` 等，消除重复。

## Risks / Trade-offs

**[翻译文件体积]** → 274 条字符串 JSON 约 15-20KB，对桌面应用可忽略。两个语言包总共 ~40KB，直接静态打包。

**[Agent 工具描述不翻译]** → AI 模型收到的工具描述始终是中文。如果未来需要英文 Agent，需要单独处理。当前保持不变是正确选择，因为 Manager 的 AI prompt 也全是中文。

**[遗漏翻译]** → 可能在迁移过程中遗漏某些动态拼接的字符串。缓解：完成后全局搜索中文字符验证。

**[Manager 前端未覆盖]** → Manager 的 198 条中文本次不做，后续可复用相同模式独立实施。
