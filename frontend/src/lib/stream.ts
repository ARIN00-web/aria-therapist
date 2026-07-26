import { getAccessToken } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface StreamHandlers {
  onToken?: (text: string) => void;
  onCrisis?: (data: { content: string; resources?: unknown }) => void;
  onDone?: (data: { sessionId: string }) => void;
  onError?: (message: string) => void;
}

/**
 * Streams an SSE response from a POST endpoint that requires a Bearer token.
 * The native EventSource API only supports GET without custom headers, so we
 * read the response body manually and parse the `event:`/`data:` frames.
 */
export async function streamMessage(
  sessionId: string,
  message: string,
  handlers: StreamHandlers
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ message }),
  });

  if (!res.ok || !res.body) {
    let msg = 'Failed to send message';
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch { /* ignore */ }
    handlers.onError?.(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        const lines = frame.split('\n');
        let event = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;

        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(data); } catch { continue; }

        switch (event) {
          case 'token':
            handlers.onToken?.(parsed.content as string);
            break;
          case 'crisis':
            terminated = true;
            handlers.onCrisis?.(parsed as { content: string });
            break;
          case 'error':
            terminated = true;
            handlers.onError?.((parsed.content as string) || 'Aria could not respond just now. Please try again.');
            break;
          case 'done':
            terminated = true;
            handlers.onDone?.(parsed as { sessionId: string });
            break;
        }
      }
    }
  } catch {
    // The connection dropped while streaming (e.g. network loss or the server
    // closing the socket). Surface it so the UI can leave its streaming state.
    if (!terminated) {
      handlers.onError?.('The connection was interrupted. Please try again.');
      return;
    }
  }

  // The stream closed without a terminal event (server died mid-response, etc.).
  // Without this the caller would stay in its "streaming" state indefinitely.
  if (!terminated) {
    handlers.onError?.('Aria could not finish responding. Please try again.');
  }
}
