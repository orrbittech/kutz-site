import { defineRouting } from 'next-intl/routing';

/** Supported next-intl locales (message files under `messages/`). */
export const routing = defineRouting({
  locales: ['en'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];
