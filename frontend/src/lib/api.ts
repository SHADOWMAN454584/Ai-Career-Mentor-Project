const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API}${path}`, { ...options, headers });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body === 'object' && body !== null && 'detail' in body ? body.detail : undefined;
    const message = response.status === 401
      ? 'Your session has expired. Sign in again.'
      : response.status === 413
        ? 'That file is too large. Choose a smaller resume.'
        : response.status === 415
          ? 'Use a PDF or DOCX resume.'
          : response.status >= 500
            ? 'The service is temporarily unavailable. Try again shortly.'
            : typeof detail === 'string' ? detail : 'Something went wrong. Try again.';
    throw new Error(message);
  }
  return body as T;
}
