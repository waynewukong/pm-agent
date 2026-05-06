import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, '..');

function resolveProjectPath(value, fallback) {
  const raw = value || fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
}

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',
  provider: (process.env.AGENT_LLM_PROVIDER || 'mock').toLowerCase(),
  model: process.env.AGENT_LLM_MODEL || 'local-mock',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  dataDir: resolveProjectPath(process.env.DATA_DIR, './data'),
  artifactsDir: resolveProjectPath(process.env.ARTIFACTS_DIR, './data/artifacts'),
  knowledgeBaseDir: resolveProjectPath(process.env.KNOWLEDGE_BASE_DIR, './knowledge_base')
};

export function ensureRuntimeDirs() {
  for (const dir of [config.dataDir, config.artifactsDir, config.knowledgeBaseDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function publicConfigStatus() {
  const keyByProvider = {
    openai: Boolean(config.openaiApiKey),
    deepseek: Boolean(config.deepseekApiKey),
    anthropic: Boolean(config.anthropicApiKey),
    mock: true
  };

  const configured = keyByProvider[config.provider] || false;

  return {
    provider: config.provider,
    model: config.model,
    configured,
    mode: configured && config.provider !== 'mock' ? 'llm' : 'mock',
    availableProviders: ['mock', 'openai', 'deepseek', 'anthropic'],
    dataDir: config.dataDir,
    knowledgeBaseDir: config.knowledgeBaseDir
  };
}
