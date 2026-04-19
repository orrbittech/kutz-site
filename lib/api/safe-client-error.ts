const MAX_CLIENT_ERROR_LENGTH = 220;

/**
 * Bounded, user-facing error text for toasts and inline UI. Does not log or stringify arbitrary objects.
 */
export function safeClientErrorMessage(err: unknown, fallback: string): string {
  if (err == null || err === undefined) {
    return fallback;
  }
  if (typeof err === 'string') {
    const t = err.trim();
    if (!t) return fallback;
    return t.length > MAX_CLIENT_ERROR_LENGTH ? `${t.slice(0, MAX_CLIENT_ERROR_LENGTH)}…` : t;
  }
  if (err instanceof Error) {
    const t = err.message.trim();
    if (!t) return fallback;
    return t.length > MAX_CLIENT_ERROR_LENGTH ? `${t.slice(0, MAX_CLIENT_ERROR_LENGTH)}…` : t;
  }
  return fallback;
}
