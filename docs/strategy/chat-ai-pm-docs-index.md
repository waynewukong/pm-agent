# AI 产品经理代理文档索引

这份索引服务于当前 `project01` 的文档型结构。

## 1. 当前文档清单

### 方法与策略

- `chat-ai-pm-design.md`：代理方案总设计
- `chat-ai-pm-action-plan.md`：行动计划与阶段划分
- `latest-chat-first-plan.md`：最早的 chat-first 方案起点

### 收敛与协议

- `chat-ai-pm-structuring-rules.md`：对话输入到结构化需求模型的收敛规则
- `chat-ai-pm-questioning-output-protocol.md`：追问策略与输出协议
- `chat-ai-pm-business-knowledge-base.md`：业务知识库模块规则，定义如何从对话和交付物中自动沉淀纯业务流转知识

### 长期业务知识库

- `/Users/lzy/Documents/obsidian/zw的脑子/LTC业务知识库/`：LTC 业务知识库主目录
- `/Users/lzy/Documents/obsidian/zw的脑子/LTC业务知识库/00-知识库首页.md`：Obsidian 知识库入口

### 交付物模板

- `../templates/chat-ai-pm-prd-template.md`：PRD 模板
- `../templates/chat-ai-pm-prototype-template.md`：原型说明模板
- `../templates/chat-ai-pm-testcase-template.md`：测试用例模板
- `../templates/chat-ai-pm-revision-log-template.md`：修订记录模板

### 真实需求交付物

- `../../deliverables/presale-actual-sale-material-no/`：用户预实销模块导出新增物料号字段
- `../../deliverables/presale-actual-sale-invoice-date-filter/`：预实销模块开票日期筛选结束日期包含当天数据

## 2. 推荐使用顺序

如果目标是继续完善这套 AI 产品经理代理，建议按这个顺序使用：

1. 先看 `chat-ai-pm-design.md`
2. 再看 `chat-ai-pm-action-plan.md`
3. 执行时参考 `chat-ai-pm-structuring-rules.md`
4. 对话输出时参考 `chat-ai-pm-questioning-output-protocol.md`
5. 业务知识沉淀时参考 `chat-ai-pm-business-knowledge-base.md`
6. 产出文档时套用 `../templates/` 下的四份模板

原型阶段的固定规则：

1. 先向用户索要业务页面截图
2. 基于截图输出原型说明
3. 使用 Figma MCP 生成高保真原型
4. 将 Figma 原型与 PRD、测试用例保持同一版本

## 3. 当前完成状态

### 已完成

- 代理方案定义
- 行动计划
- 收敛规则
- 追问与输出协议
- PRD 模板
- 原型说明模板
- 测试用例模板
- 修订记录模板
- 业务知识库模块规则
- LTC 业务知识库纯业务目录和待补充卡片
- 目录整理与分层归档
- 前后端代码与依赖清理

### 下一步

按现有行动计划，下一阶段应转向：

1. 用真实需求样本验证这些规则和模板
2. 每次需求修订同步更新 LTC 业务知识库
3. 记录例外场景、补丁规则和知识冲突
4. 开始设计 PM Agent 的系统结构

## 4. 使用建议

如果后续你继续让我直接协作，最实用的方式是：

1. 用这套规则和协议来约束我的输出
2. 用四份模板承接正式交付物
3. 用 LTC 业务知识库承接业务对象生成、状态流转和上下游因果知识
4. 用真实样本持续打磨，而不是先做产品壳

这套文档现在已经足够支撑手工代理阶段。
