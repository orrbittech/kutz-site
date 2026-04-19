import { SignIn } from '@clerk/nextjs';

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  const prefix = `/${locale}`;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen items-center justify-center bg-brand-cream/50 px-4 py-12 outline-none"
    >
      <SignIn
        fallbackRedirectUrl={`${prefix}/account`}
        appearance={{
          layout: {
            socialButtonsVariant: 'blockButton',
            socialButtonsPlacement: 'top',
          },
          elements: {
            card: 'shadow-xl border border-border',
            headerTitle: 'uppercase tracking-[0.2em]',
            formButtonPrimary: 'bg-primary text-brand-white hover:bg-brand-orange rounded-md',
            socialButtonsBlockButton: 'border border-border',
          },
        }}
        signUpUrl={`${prefix}/sign-up`}
      />
    </main>
  );
}
