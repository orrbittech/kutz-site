import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-6 shadow-sm transition hover:shadow-md',
        className,
      )}
      {...props}
    />
  );
}
