# 15 - file_read 双倍 IO

## 问题描述

先读 8KB 探测二进制，再全量读取，大文件等于双倍 IO。

## 涉及代码

- `src-tauri/src/lib.rs:86-97`

## 详细整改方案

### 方案：保留 probe 数据，增量读取

```rust
let mut file = File::open(&safe_path)?;
let mut probe = [0u8; 8192];
let bytes_read = Read::read(&mut file, &mut probe)?;
if probe[..bytes_read].contains(&0) { return Err("binary"); }

// 读剩余部分
let mut rest = Vec::new();
Read::read_to_end(&mut file, &mut rest)?;

// 拼接
let mut all = Vec::with_capacity(bytes_read + rest.len());
all.extend_from_slice(&probe[..bytes_read]);
all.extend_from_slice(&rest);

let content = String::from_utf8(all)?;
Ok(json!({ "content": content }))
```

## 验证方法

1. <8KB 文件 → 正常
2. >8KB 文件 → 完整内容无丢失
3. 二进制文件 → 正确拒绝
