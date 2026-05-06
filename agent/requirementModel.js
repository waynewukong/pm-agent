const ROLE_WORDS = [
  '产品经理',
  '销售顾问',
  '销售经理',
  '审批人',
  '运营',
  '财务',
  '门店经理',
  '管理员',
  '测试',
  '开发',
  '用户'
];

const TYPE_RULES = [
  ['fix', /(bug|异常|错误|修复|对不上|失败|报错)/i],
  ['new', /(新增|新建|从 0|从零|搭一个|新模块|新能力)/i],
  ['research', /(分析|研究|探索|先别出方案|调研)/i],
  ['optimize', /(优化|提升|缩短|减少|改版|改善|效率|透明)/i]
];

export function createRequirementModel() {
  return {
    meta: {
      title: '',
      type: '',
      scenario: '',
      stage: 'intake',
      confidence: 0
    },
    actors: [],
    goal: '',
    painPoints: [],
    pages: [],
    rules: [],
    knowledgeCandidates: [],
    assumptions: [],
    openQuestions: [],
    artifacts: {
      prdReady: false,
      prototypeReady: false,
      testCasesReady: false
    },
    changeLog: []
  };
}

export function updateRequirementModel(current, text) {
  const model = normalizeModel(current);
  const cleanText = String(text || '').trim();
  if (!cleanText) return model;

  const inferredType = inferType(cleanText);
  if (inferredType && !model.meta.type) model.meta.type = inferredType;

  const title = inferTitle(cleanText, model);
  if (title && !model.meta.title) model.meta.title = title;

  const scenario = inferScenario(cleanText);
  if (scenario && !model.meta.scenario) model.meta.scenario = scenario;

  const actors = inferActors(cleanText);
  model.actors = unique([...model.actors, ...actors]);

  const goal = inferGoal(cleanText);
  if (goal && !model.goal) model.goal = goal;

  model.painPoints = unique([...model.painPoints, ...inferPainPoints(cleanText)]).slice(0, 12);
  model.pages = mergePages(model.pages, inferPages(cleanText));
  model.rules = unique([...model.rules, ...inferRules(cleanText)]).slice(0, 20);
  model.knowledgeCandidates = unique([
    ...model.knowledgeCandidates,
    ...inferKnowledgeCandidates(cleanText)
  ]).slice(0, 20);

  if (!model.meta.type) model.meta.type = 'optimize';
  updateConfidence(model);

  model.changeLog = [
    ...(model.changeLog || []),
    {
      at: new Date().toISOString(),
      source: 'user_message',
      summary: cleanText.slice(0, 80)
    }
  ].slice(-20);

  return model;
}

export function detectMissingFields(model) {
  const questions = [];

  if (!model.meta.title) {
    questions.push({
      field: 'title',
      question: '这次需求可以用什么标题概括？',
      reason: '标题会影响交付物命名和版本管理。',
      blocking: false,
      priority: 2
    });
  }

  if (!model.meta.scenario) {
    questions.push({
      field: 'scenario',
      question: '这个需求发生在哪个业务场景或业务链路里？',
      reason: '场景会影响角色、范围和业务规则判断。',
      blocking: true,
      priority: 1
    });
  }

  if (!model.goal) {
    questions.push({
      field: 'goal',
      question: '这次最想改善的结果是什么，是效率、准确性、透明度还是体验？',
      reason: '目标会决定方案优先级和验收标准。',
      blocking: true,
      priority: 1
    });
  }

  if (!model.actors.length) {
    questions.push({
      field: 'actors',
      question: '主要使用或受影响的角色有哪些？',
      reason: '角色差异会影响字段、权限和测试用例。',
      blocking: true,
      priority: 1
    });
  }

  if (!model.pages.length) {
    questions.push({
      field: 'pages',
      question: '这次会涉及哪些页面、模块或流程节点？',
      reason: '范围不清会导致 PRD 和测试用例越界。',
      blocking: true,
      priority: 1
    });
  }

  return questions.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

export function applyArtifactFlag(model, type) {
  const next = normalizeModel(model);
  if (type === 'prd') next.artifacts.prdReady = true;
  if (type === 'prototype') next.artifacts.prototypeReady = true;
  if (type === 'testcases') next.artifacts.testCasesReady = true;
  next.meta.stage = 'generate';
  updateConfidence(next);
  return next;
}

function normalizeModel(input) {
  return {
    ...createRequirementModel(),
    ...(input || {}),
    meta: { ...createRequirementModel().meta, ...(input?.meta || {}) },
    artifacts: { ...createRequirementModel().artifacts, ...(input?.artifacts || {}) },
    actors: Array.isArray(input?.actors) ? input.actors : [],
    painPoints: Array.isArray(input?.painPoints) ? input.painPoints : [],
    pages: Array.isArray(input?.pages) ? input.pages : [],
    rules: Array.isArray(input?.rules) ? input.rules : [],
    knowledgeCandidates: Array.isArray(input?.knowledgeCandidates) ? input.knowledgeCandidates : [],
    assumptions: Array.isArray(input?.assumptions) ? input.assumptions : [],
    openQuestions: Array.isArray(input?.openQuestions) ? input.openQuestions : [],
    changeLog: Array.isArray(input?.changeLog) ? input.changeLog : []
  };
}

function inferType(text) {
  return TYPE_RULES.find(([, regex]) => regex.test(text))?.[0] || '';
}

function inferTitle(text, model) {
  const explicit = text.match(/(?:需求|标题|主题)[:：]\s*([^\n。；;]{4,40})/);
  if (explicit?.[1]) return explicit[1].trim();

  const target = text.match(/(?:想|希望|需要|帮我|我要)([^。；;\n]{4,34})/);
  if (target?.[1]) return target[1].replace(/^(把|将|对)/, '').trim();

  if (!model.meta.title && text.length >= 8) {
    return text.split(/[。；;\n]/)[0].slice(0, 28).trim();
  }

  return '';
}

function inferScenario(text) {
  const explicit = text.match(/(?:场景|业务场景)[:：]\s*([^\n。；;]{3,36})/);
  if (explicit?.[1]) return explicit[1].trim();

  const ltc = text.match(/(LTC[^。；;\n]{0,24})/i);
  if (ltc?.[1]) return ltc[1].trim();

  const generic = text.match(/(?:流程|模块|业务)[:：]\s*([^\n。；;]{3,36})/);
  if (generic?.[1]) return generic[1].trim();

  const module = text.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,16}(?:审批|报价|预实销|开票|线索|合同|订单|库存)[^。；;\n]{0,16})/);
  return module?.[1]?.trim() || '';
}

function inferActors(text) {
  return ROLE_WORDS.filter((role) => text.includes(role));
}

function inferGoal(text) {
  const goalLine = text
    .split(/[\n。；;]/)
    .map((line) => line.trim())
    .find((line) => /(目标|希望|为了|提升|降低|减少|缩短|透明|效率|准确|体验)/.test(line));
  return goalLine?.slice(0, 80) || '';
}

function inferPainPoints(text) {
  return text
    .split(/[\n。；;]/)
    .map((line) => line.trim())
    .filter((line) => /(问题|痛点|现在|当前|无法|不能|缺少|看不到|太慢|很慢|麻烦|路径|对不上)/.test(line))
    .map((line) => line.slice(0, 100));
}

function inferPages(text) {
  const matches = [...text.matchAll(/([\u4e00-\u9fa5A-Za-z0-9]{2,24}(?:页面|页|列表|详情|弹窗|模块|表单|看板|节点))/g)];
  return matches.map((match) => {
    const name = match[1];
    return {
      name,
      type: inferPageType(name),
      currentState: '',
      targetChange: '',
      pageGoal: '',
      roles: [],
      linkage: '',
      risk: 'medium',
      evidence: []
    };
  });
}

function inferPageType(name) {
  if (/列表/.test(name)) return 'list';
  if (/详情/.test(name)) return 'detail';
  if (/弹窗/.test(name)) return 'modal';
  if (/表单/.test(name)) return 'form';
  if (/看板/.test(name)) return 'dashboard';
  if (/节点/.test(name)) return 'flow-node';
  return 'other';
}

function inferRules(text) {
  return text
    .split(/[\n。；;]/)
    .map((line) => line.trim())
    .filter((line) => /(规则|只有|必须|不能|状态|权限|审批|驳回|通过|取消|作废|历史|同步|生成|前置|条件)/.test(line))
    .map((line) => line.slice(0, 120));
}

function inferKnowledgeCandidates(text) {
  return inferRules(text).filter((line) => /(生成|状态|前置|条件|审批|驳回|作废|上下游|触发)/.test(line));
}

function mergePages(existing, incoming) {
  const byName = new Map(existing.map((page) => [page.name, page]));
  for (const page of incoming) {
    if (!byName.has(page.name)) byName.set(page.name, page);
  }
  return [...byName.values()].slice(0, 12);
}

function unique(items) {
  return [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

function updateConfidence(model) {
  const checks = [
    Boolean(model.meta.title),
    Boolean(model.meta.scenario),
    Boolean(model.goal),
    Boolean(model.actors.length),
    Boolean(model.pages.length),
    Boolean(model.painPoints.length || model.rules.length)
  ];
  model.meta.confidence = Number((checks.filter(Boolean).length / checks.length).toFixed(2));
}
