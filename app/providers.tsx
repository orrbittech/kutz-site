'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { Toaster } from 'react-hot-toast';

export function AppProviders({ children }: { children: ReactNode }): React.JSX.Element {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <ClerkProvider>
      <QueryClientProvider client={client}>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 4500,
            style: {
              background: '#000000',
              color: '#ffffff',
            },
          }}
        />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
