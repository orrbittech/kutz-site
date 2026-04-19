import type { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  styles: ['styles'] as const,
  bookings: ['bookings'] as const,
  /** Prefix for TanStack Query invalidation (all occupancy queries). */
  bookingsOccupancyPrefix: ['bookings', 'occupancy'] as const,
  bookingsOccupancy: (fromIso: string, toIso: string, styleIdsKey: string) =>
    ['bookings', 'occupancy', fromIso, toIso, styleIdsKey] as const,
  orders: ['orders'] as const,
  siteSettingsPublic: ['public-site-settings'] as const,
};

/** Use when a future mutation affects both domains. */
export async function invalidateBookingsAndOrders(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
    queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
  ]);
}
