'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ServiceAccordionItem = {
  name: string;
  priceLabel: string;
  description: string;
};

export function ServicesAccordion({
  items,
  className,
}: {
  items: ServiceAccordionItem[];
  className?: string;
}): React.JSX.Element {
  const defaultOpen = items[0]?.name;

  return (
    <Accordion.Root
      type="single"
      defaultValue={defaultOpen}
      collapsible
      className={cn('w-full', className)}
    >
      {items.map((item) => (
        <Accordion.Item key={item.name} value={item.name} className="border-b border-border first:border-t">
          <Accordion.Header>
            <Accordion.Trigger
              className={cn(
                'group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-foreground transition-colors',
                'hover:bg-brand-cream/40 data-[state=open]:bg-primary data-[state=open]:text-brand-white',
              )}
            >
              <span className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold uppercase tracking-wide">{item.name}</span>
                <span className="tabular-nums text-foreground/80 group-data-[state=open]:text-brand-white">{item.priceLabel}</span>
              </span>
              <ChevronDown
                className="size-5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-none">
            <div className="border-t border-white/10 bg-primary px-5 py-4 text-sm leading-relaxed text-white/90">
              {item.description}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
