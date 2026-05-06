import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTool } from '../tools/audit.js';
import { commitKnowledgeUpdate } from '../tools/knowledge.js';
import { generateArtifactForConversation, runAgentTurn } from '../agent/orchestrator.js';
import {
  addMessage,
  createConversation,
  getConversation,
  initDatabase,
  listArtifacts,
  listConversations,
  listKnowledgeCandidates,
  listMessages
} from './db.js';
import { config, publicConfigStatus } from './config.js';
import { getProviderStatus } from '../providers/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

initDatabase();

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

app.get('/api/config/status', (_req, res) => {
  res.json(getProviderStatus());
});

app.get('/api/conversations', (_req, res) => {
  res.json({ conversations: listConversations() });
});

app.post('/api/conversations', (req, res) => {
  const title = String(req.body?.title || '').trim() || '新的需求会话';
  res.status(201).json({ conversation: createConversation({ title }) });
});

app.get('/api/conversations/:id/messages', (req, res) => {
  ensureConversationExists(req.params.id);
  res.json({ messages: listMessages(req.params.id) });
});

app.post('/api/conversations/:id/messages', async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    ensureConversationExists(conversationId);
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Message content is required' });

    const userMessage = addMessage({ conversationId, role: 'user', content });
    const result = await runAgentTurn({ conversationId, userMessage: content });

    res.json({
      userMessage,
      assistantMessage: result.message,
      state: result.state,
      artifacts: result.artifacts,
      knowledgeCandidates: result.knowledgeCandidates
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/conversations/:id/state', (req, res) => {
  const conversation = ensureConversationExists(req.params.id);
  res.json({ state: conversation.state || {} });
});

app.post('/api/conversations/:id/artifacts', async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    ensureConversationExists(conversationId);
    const type = String(req.body?.type || 'prd').trim();
    const artifact = await generateArtifactForConversation({ conversationId, type });
    res.status(201).json({ artifact });
  } catch (error) {
    next(error);
  }
});

app.get('/api/conversations/:id/artifacts', (req, res) => {
  ensureConversationExists(req.params.id);
  res.json({ artifacts: listArtifacts(req.params.id) });
});

app.get('/api/conversations/:id/knowledge-candidates', (req, res) => {
  ensureConversationExists(req.params.id);
  res.json({ knowledgeCandidates: listKnowledgeCandidates(req.params.id) });
});

app.post('/api/knowledge/candidates/:id/confirm', async (req, res, next) => {
  try {
    const candidate = await runTool({
      conversationId: null,
      toolName: 'commit_knowledge_update',
      input: { candidateId: req.params.id },
      fn: () => commitKnowledgeUpdate(req.params.id)
    });
    res.json({ candidate });
  } catch (error) {
    next(error);
  }
});

app.get('/api/public-config', (_req, res) => {
  res.json(publicConfigStatus());
});

const distDir = path.resolve(__dirname, '../apps/web/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: error.message || 'Internal Server Error'
  });
});

app.listen(config.port, config.host, () => {
  console.log(`PM Agent listening on http://${config.host}:${config.port}`);
});

function ensureConversationExists(id) {
  const conversation = getConversation(id);
  if (!conversation) {
    const error = new Error('Conversation not found');
    error.status = 404;
    throw error;
  }
  return conversation;
}
