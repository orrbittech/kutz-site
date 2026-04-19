'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { isApiError } from '@/lib/api/api-error';
import {
  buildErrorReport,
  buildMailtoHref,
  buildWhatsAppHref,
  copyTextToClipboard,
  normalizeWhatsAppDigits,
} from '@/lib/error-report';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const outlineLinkClass = cn(
  'inline-flex w-full items-center justify-center rounded px-5 py-2.5 text-sm font-semibold uppercase tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 sm:w-auto',
  'border-2 border-foreground text-foreground bg-transparent hover:bg-brand-cream/60',
);

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  const t = useTranslations('errorPage');
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    setPageUrl(typeof window !== 'undefined' ? window.location.href : undefined);
  }, []);

  const report = useMemo(() => buildErrorReport(error, { pageUrl }), [error, pageUrl]);

  const supportEmail = process.env.NEXT_PUBLIC_ERROR_REPORT_EMAIL?.trim();
  const whatsappDigits = normalizeWhatsAppDigits(process.env.NEXT_PUBLIC_ERROR_REPORT_WHATSAPP);

  const mailtoHref =
    supportEmail && supportEmail.length > 0
      ? buildMailtoHref(supportEmail, t('reportSubject'), report)
      : null;
  const whatsappHref =
    whatsappDigits != null ? buildWhatsAppHref(whatsappDigits, report) : null;
  const hasContact = mailtoHref != null || whatsappHref != null;

  const status = isApiError(error) ? error.status : undefined;
  const network = isApiError(error) && error.kind === 'network';

  let title = t('titleDefault');
  let description = t('descDefault');

  if (network) {
    title = t('titleNetwork');
    description = t('descNetwork');
  } else if (status === 404) {
    title = t('titleNotFound');
    description = t('descNotFound');
  } else if (status === 401 || status === 403) {
    title = t('titleAuth');
    description = t('descAuth');
  } else if (status != null && status >= 500) {
    title = t('titleServer');
    description = t('descServer');
  }

  async function handleCopy(): Promise<void> {
    const ok = await copyTextToClipboard(report);
    if (ok) {
      toast.success(t('copiedToast'));
    } else {
      toast.error(t('copyFailed'));
    }
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 py-16">
      <Card className="max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-foreground/75">{description}</p>
        {error.message && !network ? (
          <p className="font-mono text-xs text-foreground/55">{error.message}</p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => void handleCopy()}>
            {t('copyDetails')}
          </Button>
          <Button type="button" variant="primary" onClick={() => reset()}>
            {t('tryAgain')}
          </Button>
        </div>

        <footer className="border-t border-border pt-6 text-left text-sm text-foreground/80">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">
            {t('footerHeading')}
          </p>
          {hasContact ? (
            <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
              {mailtoHref != null ? (
                <a className={outlineLinkClass} href={mailtoHref}>
                  {t('emailDeveloper')}
                </a>
              ) : null}
              {whatsappHref != null ? (
                <a
                  className={outlineLinkClass}
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('whatsappDeveloper')}
                </a>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-center text-xs text-foreground/65">{t('footerFallback')}</p>
          )}
        </footer>
      </Card>
    </div>
  );
}
