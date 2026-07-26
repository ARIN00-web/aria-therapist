import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from '../config/env';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GeminiTextRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  timeoutMs: number;
  utility?: boolean;
}

let genAI: GoogleGenerativeAI | null = null;
function getGenAIClient(): GoogleGenerativeAI {
  if (!genAI) {
    const config = getConfig();
    genAI = new GoogleGenerativeAI(config.geminiApiKey || '');
  }
  return genAI;
}

export async function callGeminiText({
  system,
  messages,
  maxTokens = 800,
  timeoutMs,
  utility
}: GeminiTextRequest): Promise<string | null> {
  const config = getConfig();

  // Route to OpenRouter if configured
  if (config.openrouterApiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${config.openrouterApiKey}`,
          'http-referer': 'http://localhost:3000',
          'x-title': 'Aria Therapist'
        },
        body: JSON.stringify({
          model: config.openrouterModel,
          messages: [
            { role: 'system', content: system },
            ...messages.map((m) => ({ role: m.role, content: m.content }))
          ],
          max_tokens: maxTokens,
          temperature: utility ? 0 : 0.7
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[OpenRouter LLM] API error: ${response.statusText} (${response.status}) - ${errText}`);
        return null;
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('[OpenRouter LLM] Non-stream generation failed:', error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Route to DeepSeek if deepseekApiKey is configured
  if (config.deepseekApiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${config.deepseekApiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: system },
            ...messages.map((m) => ({ role: m.role, content: m.content }))
          ],
          max_tokens: maxTokens,
          temperature: utility ? 0 : 0.7
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[DeepSeek LLM] API error: ${response.statusText} (${response.status}) - ${errText}`);
        return null;
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('[DeepSeek LLM] Non-stream generation failed:', error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Fallback to Gemini
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const client = getGenAIClient();
    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: system,
    });

    const geminiHistory = messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    
    const lastMsg = messages[messages.length - 1];
    const userPrompt = lastMsg ? lastMsg.content : '';

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: utility ? 0 : 0.7,
      }
    });

    const result = await chat.sendMessage(userPrompt, { signal: controller.signal });
    return result.response.text() || null;
  } catch (error) {
    console.error('[Gemini LLM] Text generation failed:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function streamGeminiResponse({
  system,
  messages,
  onText
}: {
  system: string;
  messages: ChatMessage[];
  onText: (chunk: string) => void;
}): Promise<string> {
  const config = getConfig();

  // Route to OpenRouter if configured
  if (config.openrouterApiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let fullText = '';

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${config.openrouterApiKey}`,
          'http-referer': 'http://localhost:3000',
          'x-title': 'Aria Therapist'
        },
        body: JSON.stringify({
          model: config.openrouterModel,
          messages: [
            { role: 'system', content: system },
            ...messages.map((m) => ({ role: m.role, content: m.content }))
          ],
          stream: true,
          max_tokens: 900,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error: ${response.statusText} (${response.status}) - ${errText}`);
      }

      const reader = (response.body as any)?.getReader();
      if (!reader) {
        throw new Error('OpenRouter response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;
          if (cleanLine === 'data: [DONE]') continue;

          if (cleanLine.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(cleanLine.slice(6));
              const chunkText = parsed.choices?.[0]?.delta?.content || '';
              if (chunkText) {
                fullText += chunkText;
                onText(chunkText);
              }
            } catch (err) {
              // Parse errors are fine for split lines
            }
          }
        }
      }

      return fullText;
    } catch (error) {
      console.error('[OpenRouter LLM] Streaming failed:', error);
      const fallback = createFallbackResponse(messages[messages.length - 1]?.content || '');
      onText(fallback);
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Route to DeepSeek if deepseekApiKey is configured
  if (config.deepseekApiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let fullText = '';

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${config.deepseekApiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: system },
            ...messages.map((m) => ({ role: m.role, content: m.content }))
          ],
          stream: true,
          max_tokens: 900,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek API error: ${response.statusText} (${response.status}) - ${errText}`);
      }

      const reader = (response.body as any)?.getReader();
      if (!reader) {
        throw new Error('DeepSeek response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;
          if (cleanLine === 'data: [DONE]') continue;

          if (cleanLine.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(cleanLine.slice(6));
              const chunkText = parsed.choices?.[0]?.delta?.content || '';
              if (chunkText) {
                fullText += chunkText;
                onText(chunkText);
              }
            } catch (err) {
              // Parse errors are fine for split lines
            }
          }
        }
      }

      return fullText;
    } catch (error) {
      console.error('[DeepSeek LLM] Streaming failed:', error);
      const fallback = createFallbackResponse(messages[messages.length - 1]?.content || '');
      onText(fallback);
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Fallback to Gemini
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let fullText = '';

  try {
    const client = getGenAIClient();
    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: system,
    });

    const geminiHistory = messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    
    const lastMsg = messages[messages.length - 1];
    const userPrompt = lastMsg ? lastMsg.content : '';

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: {
        maxOutputTokens: 900,
        temperature: 0.7,
      }
    });

    const responseStream = await chat.sendMessageStream(userPrompt, { signal: controller.signal });

    for await (const chunk of responseStream.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      onText(chunkText);
    }

    return fullText;
  } catch (error) {
    console.error('[Gemini LLM] Streaming failed:', error);
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
