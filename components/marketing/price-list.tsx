import { cn } from '@/lib/cn';

export interface PriceItem {
  name: string;
  priceCents: number;
}

export function formatMoneyZAR(cents: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
}

export function PriceList({
  title,
  items,
  className,
}: {
  title: string;
  items: PriceItem[];
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70">{title}</h3>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((item) => (
          <li
            key={item.name}
            className="flex items-center justify-between gap-4 px-5 py-4 text-sm text-foreground"
          >
            <span className="font-medium">{item.name}</span>
            <span className="tabular-nums text-foreground/80">{formatMoneyZAR(item.priceCents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
