import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRequirementModel,
  detectMissingFields,
  updateRequirementModel
} from '../agent/requirementModel.js';
import { reflectArtifact } from '../agent/reflection.js';
import { canGenerate, classifyIntent } from '../agent/stateMachine.js';

test('updates requirement model from a realistic Chinese demand', () => {
  const text =
    '需求：报价审批链路效率优化。场景：LTC 报价审批。角色：销售顾问、审批人。现在列表页看不到关键审批状态，目标是缩短审批路径。涉及报价列表页、报价详情页。';

  const model = updateRequirementModel(createRequirementModel(), text);

  assert.equal(model.meta.type, 'optimize');
  assert.match(model.meta.title, /报价审批/);
  assert.match(model.meta.scenario, /LTC|报价审批/);
  assert.ok(model.actors.includes('销售顾问'));
  assert.ok(model.pages.some((page) => page.name.includes('列表')));
  assert.ok(model.meta.confidence > 0.5);
});

test('detects missing blocking fields for sparse input', () => {
  const model = updateRequirementModel(createRequirementModel(), '帮我优化一下页面');
  const missing = detectMissingFields(model);

  assert.ok(missing.some((item) => item.field === 'scenario'));
  assert.ok(missing.some((item) => item.blocking));
});

test('classifies generation and revision intents', () => {
  assert.equal(classifyIntent('请生成第一版 PRD'), 'generate');
  assert.equal(classifyIntent('帮我改一下刚才的测试用例'), 'revise');
  assert.equal(classifyIntent('确认，可以定稿'), 'finalize');
});

test('allows generation when user explicitly asks for it', () => {
  const model = updateRequirementModel(createRequirementModel(), '帮我做一个报价审批需求');
  const missing = detectMissingFields(model);

  assert.equal(canGenerate(model, missing, 'generate'), true);
});

test('reflection catches invalid artifacts', () => {
  const result = reflectArtifact({
    type: 'prd',
    content: '太短',
    model: createRequirementModel()
  });

  assert.equal(result.passed, false);
  assert.ok(result.issues.length >= 1);
});
