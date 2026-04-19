import type { Metadata } from 'next';
import { AppChrome } from '@/components/app-chrome';
import { getLocalePageMetadata } from '@/lib/server/locale-page-metadata';
import { OrdersView } from './orders-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return getLocalePageMetadata(params, 'orders', 'ordersTitle', 'ordersDescription');
}

export default function OrdersPage(): React.JSX.Element {
  return (
    <AppChrome>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 md:px-6"
      >
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">Orders</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold uppercase tracking-tight md:text-4xl">Service orders</h1>
          <p className="mt-3 max-w-2xl text-sm text-foreground/75">
            Create a simple order snapshot — totals recompute on the server and notes stay encrypted at rest.
          </p>
        </div>
        <OrdersView />
      </main>
    </AppChrome>
  );
}
