import { LLMProvider } from './base.js';

export class MockProvider extends LLMProvider {
  constructor(options = {}) {
    super({ model: options.model || 'local-mock' });
    this.reason = options.reason || 'No external provider configured';
  }

  async chat({ messages = [] } = {}) {
    const latest = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
    return {
      provider: 'mock',
      model: this.model,
      content: [
        '我已用本地 mock 模型处理这轮输入。',
        latest ? `当前输入摘要：${latest.slice(0, 120)}` : '',
        '配置 OpenAI 或 DeepSeek API Key 后，系统会切换到真实模型。'
      ]
        .filter(Boolean)
        .join('\n')
    };
  }

  async structuredOutput() {
    return {
      provider: 'mock',
      model: this.model,
      note: this.reason
    };
  }
}
