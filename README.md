# PM Agent

一个可下载运行的本地优先 AI 产品经理 Agent。它可以通过多轮对话完成需求澄清、结构化建模、PRD / 原型说明 / 测试用例生成，并把长期业务知识先沉淀为候选项，等待用户确认后写入本地知识库。

## 快速启动

```bash
git clone <your-repo-url>
cd project01
cp .env.example .env
docker compose up
```

打开浏览器访问：

```text
http://localhost:3000
```

默认使用 `mock` 模式，不需要模型 Key 也能启动和体验基础流程。要接入真实模型，编辑 `.env`：

```bash
AGENT_LLM_PROVIDER=openai
AGENT_LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_key
```

或：

```bash
AGENT_LLM_PROVIDER=deepseek
AGENT_LLM_MODEL=deepseek-chat
DEEPSEEK_API_KEY=your_key
```

## 当前能力

- 对话式需求收敛：识别场景、角色、目标、页面、痛点、规则和待确认项。
- Agent 范式：`Plan-and-Execute` 主流程，局部受控工具调用，交付物前执行 Reflection 检查。
- 可替换模型：OpenAI、DeepSeek 与本地 mock provider 走统一接口。
- 本地数据：会话、消息、交付物、知识候选存入 SQLite 和本地 Markdown 文件。
- 本地知识库：业务知识候选需要人工确认后才写入 `knowledge_base/auto`。
- GitHub 交付：Docker、`.env.example`、示例需求和示例输出已包含。

## 项目结构

```text
project01/
├── apps/web/              # React + Vite 前端
├── agent/                 # Agent 状态机、需求模型、编排流程
├── providers/             # OpenAI / DeepSeek / mock 模型适配器
├── server/                # Express API 与 SQLite 初始化
├── tools/                 # 规则检索、文档生成、知识库、审计工具
├── docs/                  # Agent 规则、策略和交付物模板
├── examples/              # 示例输入与示例输出
├── knowledge_base/        # 使用者本地业务知识库
└── data/                  # SQLite 与生成交付物，默认不提交
```

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev
```

- 本地开发需要 Node.js 24 或更高版本，因为项目使用 Node 内置 SQLite。
- 前端开发服务：`http://localhost:5173`
- 后端 API：`http://localhost:3000`

构建并用后端托管前端：

```bash
npm run build
npm start
```

## API

- `GET /api/config/status`：检查模型配置状态。
- `POST /api/conversations`：创建需求会话。
- `POST /api/conversations/:id/messages`：发送用户输入并触发 Agent。
- `GET /api/conversations/:id/state`：查看结构化需求模型。
- `POST /api/conversations/:id/artifacts`：生成 PRD / 原型说明 / 测试用例。
- `GET /api/conversations/:id/artifacts`：查看交付物版本。
- `POST /api/knowledge/candidates/:id/confirm`：确认写入本地知识库。

## 数据与隐私

- `.env` 不会提交，模型 Key 由使用者自己保存。
- `data/` 默认不提交，保存 SQLite 数据库和生成交付物。
- `knowledge_base/**/*.md` 默认不提交，避免误传私有业务知识。
- 示例内容放在 `examples/`，不依赖个人 Obsidian 路径。

## 示例

可直接把 `examples/sample-demand.md` 中的内容粘贴到网页对话框。示例输出见：

```text
examples/sample-output/prd.md
```

## 现有资料

`docs/strategy` 和 `docs/templates` 是 Agent 的规则来源，包括：

- 对话式 AI 产品经理代理方案
- 结构化需求模型收敛规则
- 追问策略与输出协议
- 业务知识库模块规则
- PRD、原型说明、测试用例、修订记录模板
