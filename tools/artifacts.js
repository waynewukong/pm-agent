import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
import { listArtifacts, nextArtifactVersion, saveArtifactRecord } from '../server/db.js';
import { reflectArtifact } from '../agent/reflection.js';

export function renderArtifact({ type, model, messages = [] }) {
  if (type === 'prd') return renderPrd({ model, messages });
  if (type === 'prototype') return renderPrototypeSpec({ model });
  if (type === 'testcases') return renderTestCases({ model });
  if (type === 'revision') return renderRevisionLog({ model, messages });
  throw new Error(`Unsupported artifact type: ${type}`);
}

export function saveArtifact({ conversationId, type, content, model }) {
  const reflection = reflectArtifact({ type, content, model });
  if (!reflection.passed) {
    const critical = reflection.issues.filter((issue) => !issue.includes('假设'));
    if (critical.length) {
      throw new Error(`Reflection failed: ${critical.join('；')}`);
    }
  }

  const version = nextArtifactVersion(conversationId, type);
  const safeType = type.replace(/[^a-z0-9_-]/gi, '-');
  const dir = path.join(config.artifactsDir, conversationId);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${safeType}-v${version}.md`);
  fs.writeFileSync(filePath, content, 'utf8');

  return saveArtifactRecord({
    conversationId,
    type,
    title: `${artifactLabel(type)} v${version}`,
    version,
    content,
    filePath,
    reflection
  });
}

export function readConversationArtifacts(conversationId) {
  return listArtifacts(conversationId);
}

export function diffArtifacts(before = '', after = '') {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const removed = beforeLines.filter((line) => line && !afterLines.includes(line));
  const added = afterLines.filter((line) => line && !beforeLines.includes(line));
  return { added: added.slice(0, 80), removed: removed.slice(0, 80) };
}

function renderPrd({ model, messages }) {
  const title = model.meta.title || '未命名需求';
  const latestUserInput = [...messages].reverse().find((message) => message.role === 'user')?.content || '';

  return `# ${title}

## 1. 背景与目标

- 【已确认】业务场景：${valueOrPending(model.meta.scenario)}
- 【已确认】需求类型：${model.meta.type || 'optimize'}
- 【已确认 / 假设】需求目标：${valueOrPending(model.goal)}
- 【已确认】最近输入摘要：${latestUserInput.slice(0, 180) || '暂无'}

## 2. 现状与问题

${list(model.painPoints, '当前问题待继续补充。')}

## 3. 用户与角色

${table(
    ['角色', '在流程中的职责', '本期关注点'],
    (model.actors.length ? model.actors : ['【待确认】主要角色']).map((role) => [
      role,
      '围绕本需求完成业务操作或评审',
      model.goal || '待确认'
    ])
  )}

## 4. 范围与边界

- 【已确认 / 假设】本期涉及页面 / 模块：${model.pages.map((page) => page.name).join('、') || '【待确认】'}
- 【待确认】不在本期范围：需在评审中确认是否存在明确排除项。
- 【待确认】上下游影响：需确认本需求是否影响其他流程、状态或报表。

## 5. 页面 / 模块方案

${renderPagePlans(model)}

## 6. 业务规则

${list(model.rules, '暂无已确认业务规则，后续根据用户补充沉淀。')}

## 7. 交互说明

1. 用户进入相关页面或流程节点。
2. 系统展示本需求涉及的关键信息、状态或操作入口。
3. 用户完成查看、提交、审批、修订或确认动作。
4. 操作结果同步更新到相关页面或记录。

## 8. 风险与依赖

- 【待确认】历史数据兼容策略。
- 【待确认】不同角色权限是否存在差异。
- 【待确认】是否存在接口、数据源或外部系统依赖。

## 9. 验收标准

- 主角色可以在本期范围内完成目标操作。
- 关键状态、字段或提示在相关页面保持一致。
- 异常、空值、历史数据场景有明确兜底表现。
- 测试用例覆盖主流程、角色差异、状态规则和异常场景。

## 10. 开发与测试关注点

- 关注跨页面数据一致性。
- 关注权限、状态和历史数据的边界。
- 关注交付物中所有【假设】和【待确认】项是否在评审前关闭。

## 11. 假设与待确认项

### 11.1 当前假设

${list(model.assumptions, '【假设】若信息不足，默认先按存量系统优化需求处理。')}

### 11.2 待确认项

${list(model.openQuestions.map((item) => item.question || item), '【待确认】暂无额外待确认项。')}

## 12. 修订记录

- v0.1：Agent 初版生成。
`;
}

function renderPrototypeSpec({ model }) {
  const title = model.meta.title || '未命名需求';
  return `# ${title} 原型说明

## 1. 原型范围

- 【已确认 / 假设】页面 / 模块：${model.pages.map((page) => page.name).join('、') || '【待确认】'}
- 【已确认 / 假设】目标角色：${model.actors.join('、') || '【待确认】'}

## 2. 页面结构

${model.pages.length ? model.pages.map((page, index) => `### ${index + 1}. ${page.name}

- 页面类型：${page.type}
- 页面目标：${page.pageGoal || model.goal || '【待确认】'}
- 核心信息：围绕本需求目标展示关键状态、记录和操作结果。
- 核心操作：查看详情、提交、确认、审批或修订，具体按钮按业务规则确认。
`).join('\n') : '- 【待确认】需补充具体页面或流程节点。'}

## 3. 交互链路

1. 用户从入口页面进入。
2. 查看本需求相关摘要。
3. 进入详情或弹窗完成操作。
4. 返回入口页后看到结果同步。

## 4. 假设与待确认项

- 【假设】第一版原型采用现有系统信息架构，不做大规模导航改版。
- 【待确认】是否需要基于真实截图制作高保真原型。
`;
}

function renderTestCases({ model }) {
  const title = model.meta.title || '未命名需求';
  const modules = model.pages.map((page) => page.name).join('、') || '相关页面 / 模块';
  const actors = model.actors.join('、') || '目标角色';

  return `# ${title} 测试用例

## 1. 覆盖范围

- 【已确认 / 假设】涉及页面 / 模块：${modules}
- 【已确认 / 假设】涉及角色：${actors}
- 【已确认 / 假设】重点风险：状态、权限、历史数据和跨页面一致性。

## 2. 测试策略

- 主流程验证：确认目标角色可以完成核心操作。
- 联动验证：确认列表、详情、弹窗或流程节点之间数据一致。
- 角色差异验证：确认不同角色看到的字段和动作符合权限。
- 异常验证：覆盖空值、接口失败、脏数据和历史数据。

## 3. 测试用例明细

| 编号 | 类型 | 标题 | 前置条件 | 步骤 | 预期结果 | 优先级 | 页面 / 模块 |
|---|---|---|---|---|---|---|---|
| TC-001 | 功能验证 | 主角色完成核心操作 | 已存在满足条件的数据 | 进入 ${modules}，查看关键信息并完成目标操作 | 操作成功，页面反馈明确，数据状态正确更新 | P0 | ${modules} |
| TC-002 | 联动验证 | 页面间状态保持一致 | 已存在跨页面可查看的数据 | 在入口页查看状态，进入详情页再次查看 | 两处状态、字段和值保持一致 | P1 | ${modules} |
| TC-003 | 角色差异验证 | 不同角色权限正确 | 准备 ${actors} 账号 | 分别登录并访问相关页面 | 可见字段和可操作按钮符合角色权限 | P1 | ${modules} |
| TC-004 | 异常验证 | 空值或历史数据兜底 | 存在缺失字段或历史数据 | 打开相关页面并触发查询 | 页面不报错，展示兜底文案或默认状态 | P1 | ${modules} |

## 4. 假设与待确认项

- 【假设】测试环境可准备不同状态和不同角色账号。
- 【待确认】是否存在必须纳入 P0 的业务状态流转规则。

## 5. 修订记录

- v0.1：Agent 初版生成。
`;
}

function renderRevisionLog({ model, messages }) {
  const title = model.meta.title || '未命名需求';
  const latest = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
  return `# ${title} 修订记录

## v0.1

- 修订来源：用户反馈
- 修订摘要：${latest || '暂无'}
- 影响范围：需求模型、相关交付物和待确认项
- 【待确认】是否需要重新生成 PRD、原型说明或测试用例
`;
}

function renderPagePlans(model) {
  if (!model.pages.length) return '- 【待确认】需补充本期涉及的页面、模块或流程节点。';
  return model.pages
    .map(
      (page, index) => `### 5.${index + 1} ${page.name}

- 页面类型：${page.type}
- 页面目标：${page.pageGoal || model.goal || '【待确认】'}
- 影响角色：${page.roles?.length ? page.roles.join('、') : model.actors.join('、') || '【待确认】'}
- 方案改动：围绕本需求目标前置关键信息、补充必要操作入口，并保证与上下游页面一致。
- 风险等级：${page.risk || 'medium'}`
    )
    .join('\n\n');
}

function artifactLabel(type) {
  return {
    prd: 'PRD',
    prototype: '原型说明',
    testcases: '测试用例',
    revision: '修订记录'
  }[type] || type;
}

function valueOrPending(value) {
  return value || '【待确认】';
}

function list(items, fallback) {
  const values = (items || []).filter(Boolean);
  if (!values.length) return `- ${fallback}`;
  return values.map((item) => `- ${item}`).join('\n');
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n');
}
