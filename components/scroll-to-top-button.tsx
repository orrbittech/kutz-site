'use client';

import { ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const SHOW_AFTER_PX = 400;

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const fn = (): void => setReduce(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduce;
}

export function ScrollToTopButton(): React.JSX.Element {
  const reduceMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = (): void => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [reduceMotion]);

  return (
    <div
      className={`fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 z-50 transition-[opacity,transform] duration-200 md:bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] md:right-6 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <button
        type="button"
        onClick={scrollTop}
        className="pointer-events-auto flex h-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-white text-foreground shadow-lg transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
        aria-label="Scroll to top"
      >
        <ChevronUp className="h-6 w-6" aria-hidden />
      </button>
    </div>
  );
}
