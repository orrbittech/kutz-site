import type { SiteSettingsPublic } from '@/lib/zod/site-settings';

export function bookingSlotStepMs(
  settings: Pick<SiteSettingsPublic, 'bookingSlotStepMinutes'>,
): number {
  return settings.bookingSlotStepMinutes * 60 * 1000;
}

export function floorToSlotUtc(scheduledAt: Date, slotStepMs: number): Date {
  if (slotStepMs <= 0) {
    throw new Error('slotStepMs must be positive');
  }
  return new Date(Math.floor(scheduledAt.getTime() / slotStepMs) * slotStepMs);
}

export function toUtcSlotStartIso(scheduledAt: Date, slotStepMs: number): string {
  return floorToSlotUtc(scheduledAt, slotStepMs).toISOString();
}
