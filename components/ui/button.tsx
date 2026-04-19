import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'outline' | 'ghost';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-primary text-brand-white hover:bg-brand-orange focus-visible:ring-2 focus-visible:ring-foreground/25 shadow-sm',
  outline:
    'border-2 border-foreground text-foreground bg-transparent hover:bg-brand-cream/60 focus-visible:ring-2 focus-visible:ring-foreground/30',
  ghost: 'text-foreground hover:bg-brand-cream/60 focus-visible:ring-2 focus-visible:ring-foreground/25',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded px-5 py-2.5 text-sm font-semibold uppercase tracking-wide transition focus:outline-none disabled:pointer-events-none disabled:opacity-50',
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
});
