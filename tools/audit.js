import { logToolCall } from '../server/db.js';

export async function runTool({ conversationId, toolName, input, fn }) {
  const startedAt = Date.now();
  try {
    const output = await fn();
    logToolCall({
      conversationId,
      toolName,
      inputSummary: summarize(input),
      outputSummary: summarize(output),
      status: 'success',
      durationMs: Date.now() - startedAt
    });
    return output;
  } catch (error) {
    logToolCall({
      conversationId,
      toolName,
      inputSummary: summarize(input),
      outputSummary: error.message,
      status: 'error',
      durationMs: Date.now() - startedAt
    });
    throw error;
  }
}

function summarize(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? {});
  return text.slice(0, 600);
}
