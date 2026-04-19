'use client';

import { ChevronUp } from 'lucide-react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { useCallback, useState } from 'react';

const SHOW_AFTER_PX = 400;

export function ScrollToTopButton(): React.JSX.Element {
  const { scrollY } = useScroll();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => {
    setVisible(y > SHOW_AFTER_PX);
  });

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [reduceMotion]);

  return (
    <motion.div
      className="pointer-events-none fixed bottom-6 right-4 z-50 md:bottom-8 md:right-6"
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 12 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.25 }}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <button
        type="button"
        onClick={scrollTop}
        className="pointer-events-auto flex h-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-white text-foreground shadow-lg transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
        aria-label="Scroll to top"
      >
        <ChevronUp className="h-6 w-6" aria-hidden />
      </button>
    </motion.div>
  );
}
