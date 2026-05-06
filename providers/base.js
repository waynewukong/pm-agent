export class LLMProvider {
  constructor({ model }) {
    this.model = model;
  }

  async chat() {
    throw new Error('chat() must be implemented by a provider');
  }

  async stream() {
    throw new Error('stream() is not implemented in this MVP');
  }

  async structuredOutput({ messages }) {
    const response = await this.chat({ messages, responseFormat: 'json_object' });
    try {
      return JSON.parse(response.content);
    } catch (error) {
      throw new Error(`Provider returned invalid JSON: ${error.message}`);
    }
  }
}
