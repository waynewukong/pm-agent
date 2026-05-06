import { getProvider } from '../providers/index.js';
import {
  addMessage,
  getConversation,
  listMessages,
  updateConversationState
} from '../server/db.js';
import { runTool } from '../tools/audit.js';
import { renderArtifact, saveArtifact } from '../tools/artifacts.js';
import {
  extractKnowledgeCandidates,
  proposeKnowledgeUpdates,
  searchBusinessKnowledge
} from '../tools/knowledge.js';
import { retrieveProjectRules } from '../tools/projectRules.js';
import {
  applyArtifactFlag,
  createRequirementModel,
  detectMissingFields,
  updateRequirementModel
} from './requirementModel.js';
import { canGenerate, classifyIntent, nextStage } from './stateMachine.js';

export async function runAgentTurn({ conversationId, userMessage }) {
  const conversation = ensureConversation(conversationId);
  const priorState = conversation.state || {};
  const previousModel = priorState.requirementModel || createRequirementModel();
  const intent = classifyIntent(userMessage);

  const rules = await runTool({
    conversationId,
    toolName: 'retrieve_project_rules',
    input: {},
    fn: () => retrieveProjectRules()
  });

  let model = await runTool({
    conversationId,
    toolName: 'update_requirement_model',
    input: { text: userMessage },
    fn: () => updateRequirementModel(previousModel, userMessage)
  });

  const missingFields = await runTool({
    conversationId,
    toolName: 'detect_missing_fields',
    input: { model },
    fn: () => detectMissingFields(model)
  });

  model.openQuestions = missingFields;
  model.meta.stage = nextStage({
    intent,
    missingFields,
    hasArtifacts: Boolean(priorState.artifactCount)
  });

  await runTool({
    conversationId,
    toolName: 'search_business_knowledge',
    input: { query: `${model.meta.scenario} ${model.meta.title}` },
    fn: () => searchBusinessKnowledge(`${model.meta.scenario} ${model.meta.title}`)
  });

  const knowledgeCandidates = await runTool({
    conversationId,
    toolName: 'extract_knowledge_candidates',
    input: { text: userMessage },
    fn: () => extractKnowledgeCandidates({ model, text: userMessage })
  });

  const savedKnowledgeCandidates = await runTool({
    conversationId,
    toolName: 'propose_knowledge_update',
    input: { count: knowledgeCandidates.length },
    fn: () => proposeKnowledgeUpdates({ conversationId, candidates: knowledgeCandidates })
  });

  const messages = listMessages(conversationId);
  const generatedArtifacts = [];
  let assistantContent;

  if (canGenerate(model, missingFields, intent)) {
    const artifactType = inferArtifactType(userMessage);
    const artifact = await generateArtifactForConversation({
      conversationId,
      type: artifactType,
      model,
      messages,
      rules
    });
    generatedArtifacts.push(artifact);
    model = applyArtifactFlag(model, artifactType);
    assistantContent = buildGeneratedResponse({ model, artifact, missingFields, savedKnowledgeCandidates });
  } else {
    assistantContent = buildClarifyResponse({ model, missingFields, savedKnowledgeCandidates });
  }

  const state = {
    ...priorState,
    requirementModel: model,
    currentIntent: intent,
    missingFields,
    lastRunAt: new Date().toISOString(),
    artifactCount: Number(priorState.artifactCount || 0) + generatedArtifacts.length
  };

  updateConversationState(conversationId, state, model.meta.title || conversation.title);
  const assistantMessage = addMessage({
    conversationId,
    role: 'assistant',
    content: assistantContent,
    meta: {
      intent,
      provider: getProvider().constructor.name,
      generatedArtifactIds: generatedArtifacts.map((artifact) => artifact.id)
    }
  });

  return {
    message: assistantMessage,
    state,
    artifacts: generatedArtifacts,
    knowledgeCandidates: savedKnowledgeCandidates
  };
}

export async function generateArtifactForConversation({ conversationId, type = 'prd', model, messages, rules }) {
  const conversation = ensureConversation(conversationId);
  const state = conversation.state || {};
  const requirementModel = model || state.requirementModel || createRequirementModel();
  const conversationMessages = messages || listMessages(conversationId);

  await runTool({
    conversationId,
    toolName: 'retrieve_project_rules',
    input: { type },
    fn: () => rules || retrieveProjectRules()
  });

  const content = await runTool({
    conversationId,
    toolName: `render_${type}`,
    input: { type, title: requirementModel.meta?.title },
    fn: () => renderArtifact({ type, model: requirementModel, messages: conversationMessages })
  });

  const artifact = await runTool({
    conversationId,
    toolName: 'save_artifact',
    input: { type },
    fn: () => saveArtifact({ conversationId, type, content, model: requirementModel })
  });

  const nextModel = applyArtifactFlag(requirementModel, type);
  const nextState = {
    ...state,
    requirementModel: nextModel,
    artifactCount: Number(state.artifactCount || 0) + 1,
    lastRunAt: new Date().toISOString()
  };
  updateConversationState(conversationId, nextState, nextModel.meta.title || conversation.title);

  return artifact;
}

function ensureConversation(conversationId) {
  const conversation = getConversation(conversationId);
  if (!conversation) throw new Error('Conversation not found');
  return conversation;
}

function inferArtifactType(text) {
  if (/(测试用例|用例|test)/i.test(text)) return 'testcases';
  if (/(原型|prototype)/i.test(text)) return 'prototype';
  if (/(修订记录|revision|变更记录)/i.test(text)) return 'revision';
  return 'prd';
}

function buildClarifyResponse({ model, missingFields, savedKnowledgeCandidates }) {
  const questions = missingFields.map((item, index) => `${index + 1}. ${item.question}`).join('\n');
  const knowledgeNote = savedKnowledgeCandidates.length
    ? `\n\n我识别到 ${savedKnowledgeCandidates.length} 条可能需要沉淀的业务知识，已先放入候选区，等待你确认。`
    : '';

  return [
    `我先按「${model.meta.title || '未命名需求'}」理解，目前阶段是 ${model.meta.stage}。`,
    model.goal ? `当前目标：${model.goal}` : '',
    questions ? `现在最影响方案质量的是：\n${questions}` : '关键信息已经基本够用，可以生成第一版交付物。',
    '你补充这些信息后，我会继续收敛需求模型并生成 PRD / 原型说明 / 测试用例。'
  ]
    .filter(Boolean)
    .join('\n\n') + knowledgeNote;
}

function buildGeneratedResponse({ model, artifact, missingFields, savedKnowledgeCandidates }) {
  const pending = missingFields.length
    ? `仍有 ${missingFields.length} 个待确认点，已在交付物中标记。`
    : '当前没有阻塞生成的待确认点。';
  const knowledgeNote = savedKnowledgeCandidates.length
    ? `同时识别到 ${savedKnowledgeCandidates.length} 条业务知识候选，需确认后才会写入本地知识库。`
    : '本轮没有需要写入知识库的候选项。';

  return [
    `已生成「${model.meta.title || '未命名需求'}」的 ${artifact.title}。`,
    pending,
    knowledgeNote,
    `文件已保存到：${artifact.filePath}`
  ].join('\n\n');
}
