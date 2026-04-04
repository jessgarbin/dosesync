import type { CalendarEvent } from '../../types/schedule';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const DELAY_BETWEEN_EVENTS_MS = 200;
const MAX_RETRIES = 3;

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

export async function createEvent(
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

    if (response.status === 429) {
      const backoff = Math.pow(2, attempt) * 1000;
      lastError = new Error('Google Calendar rate limit reached.');
      await delay(backoff);
      continue;
    }

    if (response.status === 401) {
      throw new Error('Google Calendar token expired or invalid. Try reconnecting.');
    }

    const errorText = await response.text();
    throw new Error(`Failed to create Calendar event (${response.status}): ${errorText}`);
  }

  throw lastError ?? new Error('Failed to create event after multiple attempts.');
}

export async function createEvents(
  events: CalendarEvent[],
  token: string,
): Promise<{ success: number; failed: number; errors: string[] }> {
  const timeZone = await getCalendarTimeZone(token);
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    try {
      await createEvent(event, token, timeZone);
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
