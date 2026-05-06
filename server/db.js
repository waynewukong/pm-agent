import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config, ensureRuntimeDirs } from './config.js';

let db;

function now() {
  return new Date().toISOString();
}

function toJson(value) {
  return JSON.stringify(value ?? {});
}

function fromJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function initDatabase() {
  ensureRuntimeDirs();
  const dbPath = path.join(config.dataDir, 'pm-agent.sqlite');
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      state_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      meta_json TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reflection_json TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_candidates (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      content TEXT NOT NULL,
      action TEXT NOT NULL,
      confirmed INTEGER NOT NULL DEFAULT 0,
      file_path TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      tool_name TEXT NOT NULL,
      input_summary TEXT NOT NULL,
      output_summary TEXT NOT NULL,
      status TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return db;
}

export function getDb() {
  if (!db) return initDatabase();
  return db;
}

export function createConversation({ title = '新的需求会话' } = {}) {
  const id = randomUUID();
  const createdAt = now();
  getDb()
    .prepare(
      `INSERT INTO conversations (id, title, created_at, updated_at, state_json)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, title, createdAt, createdAt, toJson({}));
  return getConversation(id);
}

export function listConversations() {
  return getDb()
    .prepare(
      `SELECT id, title, created_at AS createdAt, updated_at AS updatedAt, state_json AS stateJson
       FROM conversations ORDER BY updated_at DESC`
    )
    .all()
    .map((row) => ({ ...row, state: fromJson(row.stateJson) }));
}

export function getConversation(id) {
  const row = getDb()
    .prepare(
      `SELECT id, title, created_at AS createdAt, updated_at AS updatedAt, state_json AS stateJson
       FROM conversations WHERE id = ?`
    )
    .get(id);
  if (!row) return null;
  return { ...row, state: fromJson(row.stateJson) };
}

export function updateConversationState(id, state, title) {
  const nextTitle = title || getConversation(id)?.title || '新的需求会话';
  getDb()
    .prepare(`UPDATE conversations SET title = ?, updated_at = ?, state_json = ? WHERE id = ?`)
    .run(nextTitle, now(), toJson(state), id);
  return getConversation(id);
}

export function addMessage({ conversationId, role, content, meta = {} }) {
  const id = randomUUID();
  const createdAt = now();
  getDb()
    .prepare(
      `INSERT INTO messages (id, conversation_id, role, content, created_at, meta_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, conversationId, role, content, createdAt, toJson(meta));
  getDb().prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(createdAt, conversationId);
  return { id, conversationId, role, content, createdAt, meta };
}

export function listMessages(conversationId) {
  return getDb()
    .prepare(
      `SELECT id, conversation_id AS conversationId, role, content, created_at AS createdAt, meta_json AS metaJson
       FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`
    )
    .all(conversationId)
    .map((row) => ({ ...row, meta: fromJson(row.metaJson) }));
}

export function nextArtifactVersion(conversationId, type) {
  const row = getDb()
    .prepare(`SELECT MAX(version) AS version FROM artifacts WHERE conversation_id = ? AND type = ?`)
    .get(conversationId, type);
  return Number(row?.version || 0) + 1;
}

export function saveArtifactRecord({ conversationId, type, title, version, content, filePath, reflection }) {
  const id = randomUUID();
  const createdAt = now();
  getDb()
    .prepare(
      `INSERT INTO artifacts
       (id, conversation_id, type, title, version, content, file_path, created_at, reflection_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, conversationId, type, title, version, content, filePath, createdAt, toJson(reflection));
  return { id, conversationId, type, title, version, content, filePath, createdAt, reflection };
}

export function listArtifacts(conversationId) {
  return getDb()
    .prepare(
      `SELECT id, conversation_id AS conversationId, type, title, version, content,
              file_path AS filePath, created_at AS createdAt, reflection_json AS reflectionJson
       FROM artifacts WHERE conversation_id = ? ORDER BY created_at DESC`
    )
    .all(conversationId)
    .map((row) => ({ ...row, reflection: fromJson(row.reflectionJson, { passed: true, issues: [] }) }));
}

export function saveKnowledgeCandidateRecord({ conversationId, type, name, status, content, action }) {
  const existing = getDb()
    .prepare(
      `SELECT id FROM knowledge_candidates
       WHERE conversation_id = ? AND name = ? AND content = ? AND confirmed = 0`
    )
    .get(conversationId, name, content);
  if (existing) return getKnowledgeCandidate(existing.id);

  const id = randomUUID();
  const createdAt = now();
  getDb()
    .prepare(
      `INSERT INTO knowledge_candidates
       (id, conversation_id, type, name, status, content, action, confirmed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(id, conversationId, type, name, status, content, action, createdAt);
  return getKnowledgeCandidate(id);
}

export function getKnowledgeCandidate(id) {
  const row = getDb()
    .prepare(
      `SELECT id, conversation_id AS conversationId, type, name, status, content, action,
              confirmed, file_path AS filePath, created_at AS createdAt
       FROM knowledge_candidates WHERE id = ?`
    )
    .get(id);
  return row ? { ...row, confirmed: Boolean(row.confirmed) } : null;
}

export function listKnowledgeCandidates(conversationId) {
  return getDb()
    .prepare(
      `SELECT id, conversation_id AS conversationId, type, name, status, content, action,
              confirmed, file_path AS filePath, created_at AS createdAt
       FROM knowledge_candidates WHERE conversation_id = ? ORDER BY created_at DESC`
    )
    .all(conversationId)
    .map((row) => ({ ...row, confirmed: Boolean(row.confirmed) }));
}

export function confirmKnowledgeCandidate(id, filePath) {
  getDb()
    .prepare(`UPDATE knowledge_candidates SET confirmed = 1, file_path = ? WHERE id = ?`)
    .run(filePath, id);
  return getKnowledgeCandidate(id);
}

export function logToolCall({ conversationId = null, toolName, inputSummary, outputSummary, status, durationMs }) {
  getDb()
    .prepare(
      `INSERT INTO tool_calls
       (id, conversation_id, tool_name, input_summary, output_summary, status, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(randomUUID(), conversationId, toolName, inputSummary, outputSummary, status, durationMs, now());
}
