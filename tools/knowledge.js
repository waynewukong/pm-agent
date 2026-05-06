import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
import {
  confirmKnowledgeCandidate,
  getKnowledgeCandidate,
  saveKnowledgeCandidateRecord
} from '../server/db.js';

const PAGE_DETAIL_PATTERNS = /(页面字段|导出字段|列顺序|按钮|弹窗文案|布局|颜色|筛选项)/;

export function searchBusinessKnowledge(query = '') {
  const files = listMarkdownFiles(config.knowledgeBaseDir);
  const terms = String(query)
    .split(/\s+/)
    .filter((term) => term.length >= 2)
    .slice(0, 8);

  return files
    .map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const score = terms.reduce((total, term) => total + (content.includes(term) ? 1 : 0), 0);
      return { filePath, content: content.slice(0, 1200), score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function extractKnowledgeCandidates({ model, text }) {
  const raw = [
    ...(model.knowledgeCandidates || []),
    ...String(text || '')
      .split(/[\n。；;]/)
      .map((line) => line.trim())
      .filter((line) => /(生成|前置|条件|状态|审批|驳回|作废|触发|上下游|流转)/.test(line))
  ];

  return [...new Set(raw)]
    .map((content) => ({
      type: inferKnowledgeType(content),
      name: inferKnowledgeName(content, model),
      status: '待补充',
      content,
      action: 'pending'
    }))
    .filter(validateKnowledgeCandidate)
    .slice(0, 8);
}

export function validateKnowledgeCandidate(candidate) {
  return Boolean(candidate?.content) && !PAGE_DETAIL_PATTERNS.test(candidate.content);
}

export function proposeKnowledgeUpdates({ conversationId, candidates }) {
  return candidates.map((candidate) =>
    saveKnowledgeCandidateRecord({
      conversationId,
      type: candidate.type,
      name: candidate.name,
      status: candidate.status,
      content: candidate.content,
      action: candidate.action
    })
  );
}

export function commitKnowledgeUpdate(candidateId) {
  const candidate = getKnowledgeCandidate(candidateId);
  if (!candidate) throw new Error('Knowledge candidate not found');

  const dir = path.join(config.knowledgeBaseDir, 'auto');
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${safeFileName(candidate.name)}.md`;
  const filePath = path.join(dir, fileName);
  const block = `\n\n## ${candidate.name}\n\n- 状态：已确认\n- 类型：${candidate.type}\n- 来源会话：${candidate.conversationId}\n- 内容：${candidate.content}\n- 更新时间：${new Date().toISOString()}\n`;

  if (fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, block, 'utf8');
  } else {
    fs.writeFileSync(filePath, `# ${candidate.name}${block}`, 'utf8');
  }

  return confirmKnowledgeCandidate(candidateId, filePath);
}

function listMarkdownFiles(root) {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : [];
  });
}

function inferKnowledgeType(content) {
  if (/对象|记录/.test(content)) return 'business-object';
  if (/流程|流转|审批/.test(content)) return 'business-process';
  if (/上下游|触发/.test(content)) return 'upstream-downstream';
  return 'business-rule';
}

function inferKnowledgeName(content, model) {
  const object = content.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,16}(?:记录|申请|订单|合同|报价|状态|规则|流程))/);
  return object?.[1] || model.meta?.scenario || model.meta?.title || '业务知识候选';
}

function safeFileName(value) {
  return String(value || 'knowledge').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
}
