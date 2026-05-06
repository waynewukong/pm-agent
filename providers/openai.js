import { LLMProvider } from './base.js';

export class OpenAIProvider extends LLMProvider {
  constructor({ apiKey, model }) {
    super({ model: model || 'gpt-4o-mini' });
    this.apiKey = apiKey;
  }

  async chat({ messages = [], temperature = 0.2, responseFormat } = {}) {
    const body = {
      model: this.model,
      messages,
      temperature
    };

    if (responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    return {
      provider: 'openai',
      model: this.model,
      content: data.choices?.[0]?.message?.content || ''
    };
  }
}
