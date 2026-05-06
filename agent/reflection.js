export function reflectArtifact({ type, content, model }) {
  const issues = [];

  if (!content || content.length < 400) {
    issues.push('交付物内容过短，可能没有形成可评审版本。');
  }

  if (!model?.meta?.title) {
    issues.push('需求标题缺失。');
  }

  if (!content.includes('假设') || !content.includes('待确认')) {
    issues.push('没有显式标记假设与待确认项。');
  }

  if (type === 'prd' && !content.includes('验收标准')) {
    issues.push('PRD 缺少验收标准。');
  }

  if (type === 'testcases' && !content.includes('预期结果')) {
    issues.push('测试用例缺少预期结果。');
  }

  return {
    passed: issues.length === 0,
    issues,
    checkedAt: new Date().toISOString()
  };
}
