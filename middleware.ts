import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const localeSegment = routing.locales.join('|');

const isProtectedRoute = createRouteMatcher([
  `/:locale(${localeSegment})/orders(.*)`,
  `/:locale(${localeSegment})/admin/settings(.*)`,
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  // API routes need Clerk auth headers but must not go through next-intl rewrites/redirects.
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: [
    '/',
    // Run on all app routes except Next.js internals, Vercel internals, and static files (paths with a dot segment).
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
