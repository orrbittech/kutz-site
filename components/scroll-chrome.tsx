'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const ScrollToTopButton = dynamic(
  () => import('@/components/scroll-to-top-button').then((m) => m.ScrollToTopButton),
  { ssr: false },
);

type ScrollChromeProps = {
  children: ReactNode;
};

export function ScrollChrome({ children }: ScrollChromeProps): React.JSX.Element {
  return (
    <>
      {children}
      <ScrollToTopButton />
    </>
  );
}
