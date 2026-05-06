import { config, publicConfigStatus } from '../server/config.js';
import { MockProvider } from './mock.js';
import { OpenAIProvider } from './openai.js';
import { DeepSeekProvider } from './deepseek.js';

export function getProvider() {
  if (config.provider === 'openai' && config.openaiApiKey) {
    return new OpenAIProvider({ apiKey: config.openaiApiKey, model: config.model });
  }

  if (config.provider === 'deepseek' && config.deepseekApiKey) {
    return new DeepSeekProvider({ apiKey: config.deepseekApiKey, model: config.model });
  }

  return new MockProvider({
    model: config.model || 'local-mock',
    reason: `${config.provider} is not configured, using local mock mode`
  });
}

export function getProviderStatus() {
  return publicConfigStatus();
}
