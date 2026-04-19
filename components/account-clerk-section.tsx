'use client';

import { SignOutButton, UserButton, UserProfile } from '@clerk/nextjs';

type AccountClerkSectionProps = {
  locale: string;
};

export function AccountClerkSection({ locale }: AccountClerkSectionProps): React.JSX.Element {
  const base = `/${locale}`;
  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <UserButton afterSignOutUrl={base} />
        <SignOutButton redirectUrl={base}>
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-brand-cream"
          >
            Sign out
          </button>
        </SignOutButton>
        <p className="text-sm text-foreground/75">Update your profile below — changes sync with Clerk.</p>
      </div>
      <div className="flex w-full min-w-0 justify-center overflow-x-auto">
        <UserProfile
          appearance={{
            elements: {
              rootBox: 'w-full max-w-full flex justify-center',
              card: 'shadow-sm',
            },
          }}
        />
      </div>
    </section>
  );
}
