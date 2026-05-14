# 11 - AI Provider 每次创建新实例

## 问题描述

`provider.ts` 的 `resolveModel` 每次调用都创建新 SDK 客户端，无法复用连接池。

## 涉及代码

- `manager/server/services/ai/provider.ts`

## 详细整改方案

### 方案：按 provider 缓存客户端实例

```typescript
const clientCache = new Map<string, any>();

function getCacheKey(config: AIConfig): string {
  return `${config.provider}:${config.baseURL || 'default'}:${config.apiKey}`;
}

export function resolveModel(config: AIConfig) {
  const key = getCacheKey(config);
  let client = clientCache.get(key);

  if (!client) {
    switch (config.provider) {
      case "openai":
        client = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
        break;
      case "anthropic":
        client = createAnthropic({ apiKey: config.apiKey, baseURL: config.baseURL });
        break;
      // ... 其他 provider ...
    }
    clientCache.set(key, client);
  }

  return client(config.model);
}

export function clearProviderCache() {
  clientCache.clear();
}
```

配置更新时调用 `clearProviderCache()`。

## 验证方法

1. 连续两次 resolveModel → 只创建一个客户端
2. 修改配置后 → 缓存清除，创建新实例
