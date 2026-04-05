import type { CalendarEvent } from '../../types/schedule';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const DELAY_BETWEEN_EVENTS_MS = 200;
const MAX_RETRIES = 3;
// Hard cap on batch size. At 200ms delay this is ~20s worst case, which keeps
// the UX predictable and protects the daily Calendar API quota.
export const MAX_EVENTS_PER_BATCH = 100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCalendarTimeZone(token: string): Promise<string> {
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.timeZone) return data.timeZone;
    }
  } catch {
    // fallback
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

class TokenExpiredError extends Error {
  constructor() {
    super('Google Calendar token expired or invalid.');
    this.name = 'TokenExpiredError';
  }
}

async function postEvent(
  event: CalendarEvent,
  token: string,
  timeZone: string,
): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(CALENDAR_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: {
          dateTime: event.startTime,
          timeZone,
        },
        end: {
          dateTime: event.endTime,
          timeZone,
        },
        ...(event.recurrence?.length ? { recurrence: event.recurrence } : {}),
        ...(event.colorId ? { colorId: event.colorId } : {}),
        reminders: event.reminders,
      }),
    });

    if (response.ok) {
      return response.json();
    }

    // Transient errors (rate limit + server errors): retry with backoff
    if (response.status === 429 || response.status >= 500) {
      const backoff = Math.pow(2, attempt) * 1000;
      lastError = new Error(
        response.status === 429
          ? 'Google Calendar rate limit reached.'
          : `Google Calendar temporarily unavailable (${response.status}).`,
      );
      await delay(backoff);
      continue;
    }

    // Token expired — bubble up so caller can refresh
    if (response.status === 401) {
      throw new TokenExpiredError();
    }

    // 403 insufficient scope or other permanent errors — specific message
    if (response.status === 403) {
      const errorText = await response.text();
      throw new Error(
        `Insufficient permission to create Calendar events. Reconnect Google Calendar in settings. Detail: ${errorText}`,
      );
    }

    const errorText = await response.text();
    throw new Error(`Failed to create Calendar event (${response.status}): ${errorText}`);
  }

  throw lastError ?? new Error('Failed to create event after multiple attempts.');
}

async function createEvent(
  event: CalendarEvent,
  getToken: () => Promise<string>,
  refreshToken: () => Promise<string>,
  timeZone: string,
): Promise<unknown> {
  const token = await getToken();
  try {
    return await postEvent(event, token, timeZone);
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      // Try once with a refreshed token
      const freshToken = await refreshToken();
      return postEvent(event, freshToken, timeZone);
    }
    throw error;
  }
}

export async function createEvents(
  events: CalendarEvent[],
  getToken: () => Promise<string>,
  refreshToken: () => Promise<string>,
): Promise<{ success: number; failed: number; errors: string[] }> {
  if (events.length > MAX_EVENTS_PER_BATCH) {
    throw new Error(
      `Too many events to create (${events.length}). Maximum is ${MAX_EVENTS_PER_BATCH} per batch — please reduce the number of medications or shorten the durations.`,
    );
  }

  const initialToken = await getToken();
  const timeZone = await getCalendarTimeZone(initialToken);
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    try {
      await createEvent(event, getToken, refreshToken, timeZone);
      success++;
    } catch (error) {
      failed++;
      errors.push(
        `${event.summary}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (i < events.length - 1) {
      await delay(DELAY_BETWEEN_EVENTS_MS);
    }
  }

  return { success, failed, errors };
}
