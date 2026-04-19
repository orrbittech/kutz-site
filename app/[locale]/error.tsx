'use client';

import { useEffect } from 'react';
import { isApiError } from '@/lib/api/api-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const status = isApiError(error) ? error.status : undefined;
  const network = isApiError(error) && error.kind === 'network';

  let title = 'Something went wrong';
  let description =
    'An unexpected error occurred. You can try again or go back to the previous page.';

  if (network) {
    title = 'Connection problem';
    description =
      'We could not reach the server. Check your network and try again.';
  } else if (status === 404) {
    title = 'Not found';
    description = 'The page or resource could not be found.';
  } else if (status === 401 || status === 403) {
    title = 'Sign-in required';
    description = 'You may need to sign in to continue.';
  } else if (status != null && status >= 500) {
    title = 'Server error';
    description = 'The server had a problem. Please try again in a moment.';
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
          <Button type="button" variant="primary" onClick={() => reset()}>
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
}
