import { ApiError } from '@/lib/api/api-error';

function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `/api/v1${p}`;
}

function formatFetchErrorBody(text: string, status: number): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return `Request failed (${status})`;
  }
  try {
    const body = JSON.parse(trimmed) as {
      message?: unknown;
      error?: unknown;
    };
    if (typeof body.message === 'string') {
      return `${body.message} (${status})`;
    }
    if (Array.isArray(body.message)) {
      return `${body.message.map(String).join(', ')} (${status})`;
    }
    if (typeof body.error === 'string' && body.error !== 'Internal Server Error') {
      return `${body.error} (${status})`;
    }
  } catch {
    /* not JSON */
  }
  return trimmed.length > 280 ? `${trimmed.slice(0, 280)}… (${status})` : `${trimmed} (${status})`;
}

/** Same-origin JSON fetch without Clerk (for public routes such as occupancy). */
export async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      'Network error — check your connection and try again.',
      0,
      'network',
    );
  }
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(formatFetchErrorBody(text, res.status), res.status, 'http');
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
