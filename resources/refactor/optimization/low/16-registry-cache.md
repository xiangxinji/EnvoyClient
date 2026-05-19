# 16 - loadRegistry 频繁磁盘扫描

## 问题描述

每次 GET /api/teams 都遍历文件系统，多团队时频繁 IO。

## 涉及代码

- `manager/server/team-registry.ts:42-61`

## 详细整改方案

### 方案：内存缓存 + 增删时刷新

```typescript
let registryCache: TeamMeta[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

function invalidateCache() { registryCache = null; }

export async function loadRegistry(): Promise<TeamMeta[]> {
  if (registryCache && Date.now() - cacheTime < CACHE_TTL) return registryCache;
  // ... 扫描 ...
  registryCache = result;
  cacheTime = Date.now();
  return result;
}

export async function createTeam(...) { /* ... */ invalidateCache(); }
export async function deleteTeam(...) { /* ... */ invalidateCache(); }
```

## 验证方法

1. 连续两次 GET /api/teams → 第二次命中缓存
2. 创建/删除后立即 GET → 返回最新数据
