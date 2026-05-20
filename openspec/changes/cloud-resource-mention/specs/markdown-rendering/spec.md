## ADDED Requirements

### Requirement: Cloud resource marker detection in renderedHtml

BubbleContent 的 `renderedHtml` computed 属性 SHALL 在 markdown 渲染之前检测消息文本中的 `{cloud:N}` 标记（N 为数字索引）。每个标记 SHALL 暂时替换为占位符（避免被 markdown 解析干扰），markdown 渲染后再替换为云资源卡片 HTML。卡片 HTML SHALL 包含 `data-cloud-ref` 属性和索引信息，供后续校验逻辑使用。

#### Scenario: Text contains cloud ref marker
- **WHEN** 消息文本为 "看下{cloud:0}有没有问题"，cloudRefs[0] 为 `{ name: "report.pdf", type: "file", size: 1024000, path: "docs/report.pdf" }`
- **THEN** 渲染的 HTML 中 `{cloud:0}` 被替换为带 `data-cloud-ref="0"` 的卡片元素

#### Scenario: Multiple cloud ref markers
- **WHEN** 消息文本为 "对比{cloud:0}和{cloud:1}"，cloudRefs 有两个条目
- **THEN** 两个标记分别渲染为独立的卡片元素

#### Scenario: Marker with missing cloudRef
- **WHEN** 消息文本包含 `{cloud:5}` 但 cloudRefs 只有 2 个条目
- **THEN** `{cloud:5}` 渲染为原始文本，不崩溃
