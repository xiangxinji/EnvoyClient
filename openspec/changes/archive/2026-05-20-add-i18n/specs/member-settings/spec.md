## ADDED Requirements

### Requirement: Language selector setting
SettingsPanel SHALL 新增"语言 / Language"设置项，位于 AI 建议历史条数设置项之后、用户信息卡片之前，使用 GlassSelect 组件，标签文本通过 `t('settings.language')` 获取。

#### Scenario: 语言设置项显示
- **WHEN** 用户打开设置面板
- **THEN** 在 AI 建议历史条数下方显示语言选择下拉框，标签为当前语言的"语言"文本

#### Scenario: 切换语言后设置面板即时更新
- **WHEN** 用户将语言从中文切换为英文
- **THEN** 设置面板中所有标签、提示文本、按钮文字立即变为英文，无需刷新或重新打开面板
