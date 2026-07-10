import { getConfig } from '../config/env';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicTextRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  timeoutMs: number;
  utility?: boolean;
}

export async function callAnthropicText({
  system,
  messages,
  maxTokens = 800,
  timeoutMs,
  utility
}: AnthropicTextRequest): Promise<string | null> {
  const config = getConfig();
  if (!config.anthropicApiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: utility ? config.anthropicUtilityModel : config.anthropicChatModel,
        max_tokens: maxTokens,
        temperature: utility ? 0 : 0.7,
        system,
        messages
      })
    });

    if (!response.ok) return null;

    const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
    return data.content?.find((item) => item.type === 'text')?.text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function streamTherapyResponse({
  system,
  messages,
  onText
}: {
  system: string;
  messages: ChatMessage[];
  onText: (chunk: string) => void;
}): Promise<string> {
  const config = getConfig();

  if (!config.anthropicApiKey) {
    const fallback = createFallbackResponse(messages[messages.length - 1]?.content || '');
    for (const chunk of fallback.match(/.{1,16}(\s|$)/g) || [fallback]) {
      onText(chunk);
    }
    return fallback;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let fullText = '';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.anthropicChatModel,
        max_tokens: 900,
        temperature: 0.7,
        stream: true,
        system,
        messages
      })
    });

    if (!response.ok || !response.body) {
      throw new Error('Anthropic stream failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const payload = decoder.decode(value);
      const lines = payload.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const raw = line.replace(/^data: /, '');
        if (raw === '[DONE]') continue;
        const event = JSON.parse(raw) as { type?: string; delta?: { text?: string } };
        if (event.type === 'content_block_delta' && event.delta?.text) {
          fullText += event.delta.text;
          onText(event.delta.text);
        }
      }
    }

    return fullText;
  } catch {
    const fallback = createFallbackResponse(messages[messages.length - 1]?.content || '');
    onText(fallback);
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

function createFallbackResponse(message: string): string {
  const brief = message.length < 40;
  if (brief) {
    return "I hear you. Let's stay with that gently for a moment: what feels most present right now?";
  }

  return "It sounds like there is a lot being carried here, and I want to move carefully with you. What part of this feels heaviest today?";
}
