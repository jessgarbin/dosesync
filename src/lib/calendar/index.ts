import type { CalendarProvider } from '../../types/settings';
import type { CalendarProviderModule } from './types';
import { googleCalendarProvider } from './google/client';
import { microsoftCalendarProvider } from './microsoft/client';

export { MAX_EVENTS_PER_BATCH } from './types';
export type { CalendarProviderModule, CalendarResult } from './types';

export function getCalendarProvider(provider: CalendarProvider): CalendarProviderModule {
  switch (provider) {
    case 'google':
      return googleCalendarProvider;
    case 'microsoft':
      return microsoftCalendarProvider;
    default:
      throw new Error(`Unknown calendar provider: ${provider as string}`);
  }
}
