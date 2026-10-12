/**
 * Central HTTP client with authentication interceptor and SSE streaming support.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'campus2career_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('career_token');
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem('career_token', token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('career_token');
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  explicitToken?: string
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = explicitToken || getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // 401 Unauthorized Interceptor
  if (response.status === 401) {
    removeToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      window.location.href = '/auth';
    }
    throw new Error('Your session has expired. Please sign in again.');
  }

  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = typeof body === 'object' && body !== null && 'detail' in body ? body.detail : undefined;
    const message = response.status === 413
      ? 'That resume file is too large. Choose a file under 5 MB.'
      : response.status === 415
        ? 'Only PDF and DOCX resume formats are supported.'
        : response.status === 429
          ? 'Rate limit exceeded. Please wait a moment before trying again.'
          : response.status >= 500
            ? 'The service is temporarily unavailable. Please try again shortly.'
            : typeof detail === 'string'
              ? detail
              : 'Something went wrong. Please try again.';
    throw new Error(message);
  }

  return body as T;
}

/**
 * Stream real-time mentor response via Server-Sent Events (SSE).
 */
export async function streamMentorChat(
  payload: { message: string; target_role: string; context?: string },
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (err: Error) => void
): Promise<() => void> {
  const controller = new AbortController();
  const token = getToken();

  try {
    const response = await fetch(`${API_BASE}/mentor/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        removeToken();
        window.location.href = '/auth';
      }
      throw new Error(`Streaming failed with status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream not supported by browser environment.');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const content = trimmed.replace(/^data:\s*/, '').trim();
            if (content === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(content);
              if (parsed.chunk) {
                onChunk(parsed.chunk);
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
        onComplete();
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();
  } catch (err: unknown) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }

  return () => controller.abort();
}
