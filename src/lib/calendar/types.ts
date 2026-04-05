import type { CalendarEvent } from '../../types/schedule';

/**
 * Hard cap on batch size. At ~200ms delay between events this keeps the UX
 * predictable and protects the daily API quota for whichever calendar
 * provider is active. Providers should also enforce this internally.
 */
export const MAX_EVENTS_PER_BATCH = 100;

export interface CalendarResult {
  success: number;
  failed: number;
  errors: string[];
}

/**
 * Common interface every calendar provider implements. Each provider owns
 * its own auth, token refresh, and event schema translation — the caller
 * just picks one and hands over a neutral CalendarEvent[].
 */
export interface CalendarProviderModule {
  readonly id: 'google' | 'microsoft';
  createEvents(events: CalendarEvent[]): Promise<CalendarResult>;
}
