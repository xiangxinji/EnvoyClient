## Context

当前 Member Agent 执行任务时通过 `cloud_upload` / `cloud_upload_file` 工具上传文件到云资源，但 `parentId` 参数默认为空（根目录），且 Agent 的 instructions 没有引导 AI 规划目录结构。结果是所有文件堆积在根目录。

云资源的目录结构基于邻接表模型（`cloud_files` 表的 `parent_id` 字段），服务端已有完整的目录 CRUD 操作（`queryCloudDir`、`findCloudFile`、`insertCloudFile`）和 `POST /api/cloud/directories` 创建目录端点。AI 场景系统支持 7 种场景（chat、task、analyze、agent、dispatch、review、auto-reply），通过 `resolveForScene()` 动态解析模型配置。

## Goals / Non-Goals

**Goals:**
- 新增 `POST /api/cloud/smart-upload` 端点，接收文件 + 描述，AI 自动推理目标目录并上传
- 新增 `cloud_organize` AI 场景，使用 `generateObject` + Zod 输出结构化目录路径
- Agent 侧新增 `smart_upload` 工具，优先使用此工具上传文件到云资源
- AI 推理时只看目录结构（不含文件），优先复用现有目录

**Non-Goals:**
- 不改造已有的 `cloud_upload` / `cloud_upload_file` 工具，保持向后兼容
- 不做批量上传接口（单文件上传即可满足当前需求）
- 不做文件内容的 AI 分析（仅基于 description 文本推理目录）
- 不做目录自动清理或去重

## Decisions

### 1. 新增独立端点而非修改现有端点

选择新增 `POST /api/cloud/smart-upload`，而非在 `POST /api/cloud/files` 上增加 `description` 参数。

**理由**: 现有端点被 UI 直传文件使用（CloudResourcesPanel 的 `handleUpload`），不应受 AI 推理延迟影响。独立端点职责清晰。

### 2. AI 推理使用 `generateObject` + Zod schema

与 `review.ts`、`dispatch.ts` 同样的模式，输出结构化的 `{ reasoning, directoryPath }` 对象。

**理由**: 目录路径需要精确解析（逐级查找/创建），不能用自由文本再解析。`generateObject` 保证输出格式可靠。

### 3. 目录树只传目录结构，不含文件

AI 推理时只看到目录层级，不看到文件列表。

**理由**: 用户在探索阶段已确认此方案（选项 A）。目录结构足够 AI 做分类决策，文件列表增加 token 消耗且对分类帮助有限。

### 4. 路径解析为逐级查找 + 创建

拿到 AI 返回的 `directoryPath: ["调研", "市场分析"]` 后，从根目录开始逐级 `findCloudFile` 查找，不存在则 `insertCloudFile` + `mkdir` 创建，最终得到目标 `parentId`。

**理由**: 不需要新的 DB 函数，复用现有的 `findCloudFile` 和 `insertCloudFile`。逐级处理天然支持部分存在、部分新建的场景。

### 5. smart_upload 作为 cloudService 的新 operation

在 `src/agent/services/cloudService.ts` 中新增 `smart_upload` operation，调用 `POST /api/cloud/smart-upload`。

**理由**: 与 `cloud_upload`、`cloud_upload_file` 同属一个 service，保持一致性。工具 schema 简单：`{ filename, content, description }`，Agent 不需要关心 `parentId`。

## Risks / Trade-offs

- **AI 调用延迟** → 每次上传增加 1-3 秒 AI 推理时间。对于文件上传场景可接受，因为上传本身也需要时间。
- **目录命名不一致** → AI 可能对同类文件产生不同目录名（如"调研" vs "研究报告"）。可通过 prompt 引导 + 现有目录优先复用来缓解。
- **AI 配置缺失** → 如果 `cloud_organize` 场景没有配置模型，`resolveForScene` 会回退到默认 preset。如果没有默认 preset，返回 503 错误，客户端 fallback 到普通上传。
