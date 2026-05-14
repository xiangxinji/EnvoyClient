# 13 - Session 无持久化和清理

## 问题描述

`admin.ts` 中 session 存内存 Map，重启失效，无定时清理，长期运行内存泄漏。

## 涉及代码

- `manager/server/routes/admin.ts:6`

## 详细整改方案

### 方案：定时清理 + 文件持久化

#### 定时清理

```typescript
const SESSION_TTL = 24 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) sessions.delete(token);
  }
}, 60 * 60 * 1000).unref();
```

#### 文件持久化（可选）

```typescript
const SESSION_FILE = path.join(dataDir, "sessions.json");

function loadSessions() {
  try {
    const data = fs.readFileSync(SESSION_FILE, "utf-8");
    for (const [token, s] of Object.entries(JSON.parse(data))) {
      if (Date.now() - (s as any).createdAt < SESSION_TTL) sessions.set(token, s as any);
    }
  } catch {}
}

function saveSessions() {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(Object.fromEntries(sessions)));
}
```

## 验证方法

1. 创建 session → 重启 → 仍有效
2. 24h 后自动清理
3. Map 大小不无限增长
