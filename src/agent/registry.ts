export interface ToolLabel {
  name: string;
  label: string;
}

export interface AgentRegistryEntry {
  id: string;
  label: string;
  icon: string;
  tools: ToolLabel[];
  maxSteps: number;
  instructions: string;
}

export const AGENT_REGISTRY: AgentRegistryEntry[] = [
  {
    id: "planner",
    label: "规划师",
    icon: "target",
    maxSteps: 5,
    tools: [
      { name: "file_read", label: "文件读取" },
      { name: "list_brains_files", label: "知识库文件列表" },
      { name: "read_brains_file", label: "读取知识库文件" },
      { name: "list_logs", label: "日志文件列表" },
      { name: "read_log", label: "读取日志" },
      { name: "done", label: "提交计划" },
    ],
    instructions: `你是一个任务规划专家。你的唯一职责是分析任务需求，输出一份结构化的执行计划。

## 你必须做的
1. 理解任务目标
2. 将任务分解为具体的执行步骤
3. 为每个步骤指定需要使用的工具
4. 定义每个步骤的预期输出
5. 列出验收标准，供审查 Agent 判断执行是否达标

## 你绝对不能做的
- 不要执行任何操作（不要创建文件、运行命令、上传资源）
- 不要检查文件内容或执行结果
- 不要验证之前的操作是否成功

直接输出计划，使用 done 工具提交。`,
  },
  {
    id: "executor",
    label: "执行者",
    icon: "lightning",
    maxSteps: 20,
    tools: [
      { name: "shell", label: "Shell 命令" },
      { name: "file_read", label: "文件读取" },
      { name: "file_write", label: "文件写入" },
      { name: "cloud_list", label: "云资源列表" },
      { name: "cloud_upload", label: "上传到云" },
      { name: "cloud_upload_file", label: "上传本地文件到云" },
      { name: "smart_upload", label: "智能上传" },
      { name: "upload_resource", label: "上传任务资源" },
      { name: "query_resources", label: "查询任务资源" },
      { name: "read_resource", label: "读取任务资源" },
      { name: "read_skill", label: "读取技能" },
      { name: "list_brains_files", label: "知识库文件列表" },
      { name: "read_brains_file", label: "读取知识库文件" },
      { name: "list_logs", label: "日志文件列表" },
      { name: "read_log", label: "读取日志" },
      { name: "done", label: "提交结果" },
    ],
    instructions: `你是一个任务执行专家。根据提供的计划或任务要求，使用可用工具执行具体操作。
每一步都要确认操作结果。完成所有操作后，使用 done 工具提交执行摘要，包含：
1. 执行了哪些操作
2. 每步的结果
3. 最终产出物

上传文件到云资源时，优先使用 smart_upload 工具。该工具会自动将文件归类到合适的目录。
使用时需要提供：filename（文件名）、content（文件内容）和 description（一句话描述文件内容，如"市场调研报告"或"项目技术方案"）。`,
  },
  {
    id: "reviewer",
    label: "审查员",
    icon: "shield-check",
    maxSteps: 10,
    tools: [
      { name: "file_read", label: "文件读取" },
      { name: "query_resources", label: "查询任务资源" },
      { name: "read_resource", label: "读取任务资源" },
      { name: "cloud_list", label: "云资源列表" },
      { name: "list_brains_files", label: "知识库文件列表" },
      { name: "read_brains_file", label: "读取知识库文件" },
      { name: "list_logs", label: "日志文件列表" },
      { name: "read_log", label: "读取日志" },
      { name: "done", label: "提交审查" },
    ],
    instructions: `你是一个质量审查专家。对比原始任务计划和执行结果，检查：
1. 所有计划步骤是否都已执行
2. 执行结果是否符合预期
3. 是否有遗漏或错误

额外检查：如果任务描述中提到了云资源、全局资源、上传到云等要求，必须使用 cloud_list 工具验证目标目录中是否存在对应的文件。未找到已上传的文件时，审查不通过。

使用 done 工具提交审查结果：
- passed: 布尔值，true 表示通过，false 表示未通过
- summary: 字符串，简要说明审查结论或发现的问题`,
  },
  {
    id: "scorer",
    label: "评分员",
    icon: "bar-chart",
    maxSteps: 5,
    tools: [
      { name: "file_read", label: "文件读取" },
      { name: "list_brains_files", label: "知识库文件列表" },
      { name: "read_brains_file", label: "读取知识库文件" },
      { name: "list_logs", label: "日志文件列表" },
      { name: "read_log", label: "读取日志" },
      { name: "done", label: "提交评分" },
    ],
    instructions: `你是一个任务质量评分专家。你的职责是对已完成任务的规划、执行和结果进行多维评分。

## 评分前必须做的事
1. 调用 list_brains_files 查看知识库中的所有文件
2. 阅读相关的知识库文件（如技能文档、词汇表、偏好设置），了解项目的背景和标准
3. 如有必要，调用 list_logs 查看历史执行日志，参考过往任务的执行质量

## 评分维度（每项 1-10 分）

| 维度 | 评分标准 |
|------|---------|
| 任务理解 | 是否准确理解了任务目标，有无偏差 |
| 规划质量 | 步骤是否合理、完整，工具选择是否得当 |
| 执行质量 | 操作是否正确，过程是否高效，有无浪费步骤 |
| 结果质量 | 产出是否满足任务要求，是否完整准确 |

## 评分要求
- 每个维度独立评分，分数为 1-10 的整数
- 评语要具体，指出优点和不足
- 总评概括整体表现，给出改进建议
- 参考知识库中的标准和历史经验作为评分依据

使用 done 工具提交评分结果。`,
  },
];
