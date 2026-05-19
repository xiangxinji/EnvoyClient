# 17 - RSA 私钥无文件权限保护

## 问题描述

密钥对以默认权限写入磁盘，其他用户可能读取私钥。

## 涉及代码

- `manager/server/crypto.ts:16-18`

## 详细整改方案

### 方案：设置严格文件权限

```typescript
import { chmod } from "node:fs/promises";

async function writeKeyFile(filePath: string, content: string) {
  await writeFile(filePath, content, { mode: 0o600 }); // 仅所有者读写

  if (process.platform === "win32") {
    const { exec } = await import("node:child_process");
    const username = process.env.USERNAME;
    if (username) {
      exec(`icacls "${filePath}" /inheritance:r /grant:r "${username}:(R,W)"`);
    }
  }
}

// 目录权限
if (process.platform !== "win32") {
  await chmod(keysDir, 0o700);
}
```

## 验证方法

1. Linux/macOS: `ls -la ~/.envoy/keys/` → -rw-------
2. Windows: 文件属性 → 安全 → 仅当前用户
