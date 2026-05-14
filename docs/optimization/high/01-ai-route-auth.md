# 01 - AI 路由无认证保护

## 问题描述

`manager/server/routes/ai.ts` 中，所有 AI 推理路由均为公开接口，无任何认证保护。任何知道 Manager 地址的人都可以直接调用，消耗 AI API 额度。

**风险等级**：高 — 直接导致资金损失

## 影响范围

| 路由 | 用途 |
|------|------|
| `GET /api/ai/health` | 暴露 AI 配置状态 |
| `POST /api/ai/agent/reason` | Agent 推理 |
| `POST /api/ai/task/dispatch` | 智能任务分派 |
| `POST /api/ai/task/review` | 任务结果审查 |
| `/api/ai/chat/*` | SSE 流式聊天 |
| `/api/ai/task/*` | 任务生成 |

仅 `/api/ai/config` 添加了 `adminAuth`。

## 涉及代码

- `manager/server/routes/ai.ts:34-59` — 显式标注 "public, no auth"
- `manager/server/routes/admin.ts:9-15` — 已有 `adminAuth` 中间件可复用

## 详细整改方案

### 方案：API Key 简单认证

客户端登录后获取 token，后续 AI 请求都携带它。

#### 步骤 1：用户登录时签发 token

```typescript
// routes/users.ts — 在现有 POST /api/auth 成功后追加
const clientTokens = new Map<string, { userId: string; role: string; createdAt: number }>();

// 认证成功后：
const token = randomBytes(32).toString("hex");
clientTokens.set(token, { userId: user.username, role: user.role, createdAt: Date.now() });
return c.json({ role: user.role, token }); // 新增 token
```

#### 步骤 2：创建 AI 路由认证中间件

```typescript
// routes/ai.ts
function clientAuth(c: Context, next: Next) {
  const token = c.req.header("X-Envoy-Token")
    || c.req.query("token"); // SSE 走 query
  if (!token || !validateClientToken(token)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
}
```

#### 步骤 3：应用到 AI 路由

```typescript
app.use("/api/ai/agent/*", clientAuth);
app.use("/api/ai/task/*", clientAuth);
app.use("/api/ai/chat/*", clientAuth);
```

#### 步骤 4：客户端携带 token

```typescript
// src/api.ts
let _clientToken = "";
export function setClientToken(token: string) { _clientToken = token; }

// managerPost 自动带 header，SSE 走 ?token= query
```

## 验证方法

1. `curl -X POST http://localhost:8080/api/ai/agent/reason` → 401
2. 携带有效 token → 正常返回
3. 过期 token → 401
