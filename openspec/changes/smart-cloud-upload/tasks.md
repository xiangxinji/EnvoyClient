## 1. Shared Types & DB Layer

- [x] 1.1 `shared/types/ai.ts` — SceneType union 新增 `"cloud_organize"`
- [x] 1.2 `manager/server/db.ts` — 新增 `getCloudDirectoryTree(teamName)` 函数，递归查询所有 `type='directory'` 记录，返回树形结构

## 2. AI 场景实现

- [x] 2.1 `manager/server/services/ai/prompts/cloudOrganize.ts` — 新增 system prompt，引导 AI 根据目录树 + 文件描述输出 `{ reasoning, directoryPath }`
- [x] 2.2 `manager/server/services/ai/cloudOrganize.ts` — 新增 `handleCloudOrganize(c, resolved)` handler，使用 `generateObject` + Zod schema，接收目录树文本、文件名、description、taskContext

## 3. Smart Upload 端点

- [x] 3.1 `manager/server/routes/cloud.ts` — 新增 `POST /api/cloud/smart-upload` 端点：解析 FormData → 调用 `getCloudDirectoryTree` → 调用 `resolveForScene("cloud_organize")` + `handleCloudOrganize` → 逐级解析 directoryPath（查找/创建目录）→ 保存文件 → 返回 `{ ok, path, itemId, createdDirs }`
- [x] 3.2 AI 不可用时返回 503，包含明确的错误信息供 Agent fallback

## 4. Agent 侧工具

- [x] 4.1 `src/agent/services/cloudService.ts` — 新增 `smart_upload` operation，参数 `{ filename, content, description }`，调用 `POST /api/cloud/smart-upload`
- [x] 4.2 `src/agent/agents/executor.ts` — 更新 instructions，引导 Agent 上传文件到云资源时优先使用 `smart_upload` 并提供简短 description

## 5. 验证

- [ ] 5.1 启动后端和前端，手动测试 smart-upload 端点（curl 或 API 工具）
- [ ] 5.2 验证 AI 推理结果能正确匹配现有目录或创建新目录
- [ ] 5.3 验证 Agent 执行任务时通过 `smart_upload` 上传文件到正确目录
