import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from '../server/config.js';

const RULE_FILES = [
  'docs/strategy/chat-ai-pm-design.md',
  'docs/strategy/chat-ai-pm-structuring-rules.md',
  'docs/strategy/chat-ai-pm-questioning-output-protocol.md',
  'docs/strategy/chat-ai-pm-business-knowledge-base.md'
];

const TEMPLATE_FILES = {
  prd: 'docs/templates/chat-ai-pm-prd-template.md',
  prototype: 'docs/templates/chat-ai-pm-prototype-template.md',
  testcases: 'docs/templates/chat-ai-pm-testcase-template.md',
  revision: 'docs/templates/chat-ai-pm-revision-log-template.md'
};

export function retrieveProjectRules() {
  return {
    rules: RULE_FILES.map(readMarkdownFile).filter(Boolean),
    templates: Object.fromEntries(
      Object.entries(TEMPLATE_FILES).map(([key, filePath]) => [key, readMarkdownFile(filePath)])
    )
  };
}

function readMarkdownFile(relativePath) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return {
    path: relativePath,
    content: fs.readFileSync(absolutePath, 'utf8')
  };
}
