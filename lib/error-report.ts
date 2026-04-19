export type ErrorReportContext = {
  pageUrl?: string;
};

/**
 * Builds a concise multi-line report for developers (copy, email, WhatsApp).
 */
export function buildErrorReport(
  error: Error & { digest?: string },
  context: ErrorReportContext = {},
): string {
  const rawMessage = typeof error?.message === 'string' ? error.message.trim() : '';
  const messageLine = rawMessage !== '' ? rawMessage : '(no message)';
  const lines: string[] = [`Message: ${messageLine}`];
  if (error.digest) {
    lines.push(`Digest: ${error.digest}`);
  }
  if (context.pageUrl) {
    lines.push(`Page: ${context.pageUrl}`);
  }
  lines.push(`Time: ${new Date().toISOString()}`);
  return lines.join('\n');
}

export function buildMailtoHref(email: string, subject: string, body: string): string {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${email}?${params.toString()}`;
}

/** E.164 digits only, no leading + (e.g. 27739590288). */
export function normalizeWhatsAppDigits(raw: string | undefined): string | null {
  if (raw == null || raw.trim() === '') return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export function buildWhatsAppHref(phoneDigits: string, text: string): string {
  const url = new URL(`https://wa.me/${phoneDigits}`);
  url.searchParams.set('text', text);
  return url.toString();
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to execCommand
  }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
