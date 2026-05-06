export function classifyIntent(text = '') {
  const value = String(text).trim();
  if (/(修改|改一下|调整|修订|更新|补充到|重新生成)/.test(value)) return 'revise';
  if (/(生成|输出|产出|PRD|prd|测试用例|用例|原型|方案)/.test(value)) return 'generate';
  if (/(确认|可以了|定稿|完成|final|结束)/i.test(value)) return 'finalize';
  return 'intake';
}

export function nextStage({ intent, missingFields, hasArtifacts }) {
  if (intent === 'finalize') return 'finalize';
  if (intent === 'revise') return 'revise';
  if (intent === 'generate') return 'generate';
  if (missingFields?.length) return 'clarify';
  if (hasArtifacts) return 'revise';
  return 'structure';
}

export function canGenerate(model, missingFields = [], intent = 'intake') {
  if (intent === 'generate' || intent === 'revise') return true;
  const blockingMissing = missingFields.filter((field) => field.blocking);
  return model.meta.confidence >= 0.68 && blockingMissing.length <= 1;
}
