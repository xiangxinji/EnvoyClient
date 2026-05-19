# 12 - 团队路由校验代码重复

## 问题描述

`routes/` 下多个文件重复相同的 "获取 team header → 查找 team → 404" 模式，约 6+ 处。

## 涉及代码

- `manager/server/routes/messages.ts`
- `manager/server/routes/teams.ts`
- `manager/server/routes/ai.ts`

## 详细整改方案

### 方案：抽取 Hono 中间件

```typescript
// manager/server/middleware/requireTeam.ts
export function requireTeam(teams: Map<string, TeamInstance>) {
  return async (c: Context, next: Next) => {
    const teamName = c.req.header("X-Team") || c.req.query("team");
    if (!teamName) return c.json({ error: "Team name required" }, 400);
    const team = teams.get(teamName);
    if (!team) return c.json({ error: "Team not found" }, 404);
    c.set("team", team);
    await next();
  };
}
```

使用：

```typescript
const teamAuth = requireTeam(teams);
app.post("/api/messages", teamAuth, async (c) => {
  const team = c.get("team"); // 直接取
});
```

## 验证方法

1. 不存在的 team → 404
2. 无 team header → 400
3. 合法 team → context 中可取到实例
