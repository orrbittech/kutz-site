'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { cn } from '@/lib/cn';

export type CalendarProps = DayPickerProps;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps): React.JSX.Element {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        root: 'w-fit',
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex w-full flex-col gap-4',
        month_caption: 'flex h-9 items-center justify-center px-1',
        caption_label: 'text-sm font-medium',
        nav: 'absolute top-0 flex w-full justify-between gap-1 px-1',
        button_previous: cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-transparent p-0 hover:bg-brand-cream',
        ),
        button_next: cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-transparent p-0 hover:bg-brand-cream',
        ),
        weekdays: 'flex',
        weekday: 'w-9 text-[0.7rem] font-medium uppercase text-muted',
        week: 'mt-2 flex w-full',
        day: 'group size-9 p-0 text-center text-sm focus-within:relative',
        day_button: cn(
          'inline-flex size-9 items-center justify-center rounded-md p-0 font-normal text-foreground',
          'hover:bg-brand-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25',
          /* Selected styles apply to <td>; <button> does not inherit color — force light text on selected days */
          'group-data-[selected=true]:bg-transparent group-data-[selected=true]:text-brand-white',
          'group-data-[selected=true]:hover:bg-primary/90 group-data-[selected=true]:hover:text-brand-white',
        ),
        selected: 'rounded-md bg-primary text-brand-white hover:bg-primary hover:text-brand-white focus:bg-primary focus:text-brand-white',
        today: 'bg-brand-cream/80 font-semibold text-foreground',
        outside: 'text-muted opacity-50',
        disabled: 'text-muted opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chClass, orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('size-4', chClass)} aria-hidden />
          ) : (
            <ChevronRight className={cn('size-4', chClass)} aria-hidden />
          ),
      }}
      {...props}
    />
  );
}
