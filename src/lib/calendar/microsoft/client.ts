import type { CalendarEvent } from '../../../types/schedule';
import type { CalendarProviderModule, CalendarResult } from '../types';
import { MAX_EVENTS_PER_BATCH } from '../types';
import { getMicrosoftAuthToken, refreshMicrosoftAuthToken } from './auth';
import { toMSEvent } from './event-builder';

const EVENTS_URL = 'https://graph.microsoft.com/v1.0/me/events';
const ME_URL = 'https://graph.microsoft.com/v1.0/me/mailboxSettings';
const DELAY_BETWEEN_EVENTS_MS = 200;
const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TokenExpiredError extends Error {
  constructor() {
    super('Microsoft Graph token expired or invalid.');
    this.name = 'TokenExpiredError';
  }
}

async function getUserTimeZone(token: string): Promise<string> {
  try {
    const res = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.timeZone) return data.timeZone;
    }
  } catch {
    // fallback
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

async function postEvent(
  event: CalendarEvent,
  token: string,
  timeZone: string,
): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const body = toMSEvent(event, timeZone);
    const response = await fetch(EVENTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Graph accepts IANA timezones when Prefer is set to "outlook.timezone".
        // Without this header the server may coerce our start/end values into
        // its default timezone representation.
        Prefer: `outlook.timezone="${timeZone}"`,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return response.json();
    }

    // Transient errors (throttling + server errors): retry with backoff
    if (response.status === 429 || response.status >= 500) {
      const backoff = Math.pow(2, attempt) * 1000;
      lastError = new Error(
        response.status === 429
          ? 'Microsoft Graph throttling — too many requests.'
          : `Microsoft Graph temporarily unavailable (${response.status}).`,
      );
      await delay(backoff);
      continue;
    }

    if (response.status === 401) {
      throw new TokenExpiredError();
    }

    if (response.status === 403) {
      const errorText = await response.text();
      throw new Error(
        `Insufficient permission to create Outlook events. Reconnect Microsoft Calendar in settings. Detail: ${errorText}`,
      );
    }

    const errorText = await response.text();
    throw new Error(`Failed to create Outlook event (${response.status}): ${errorText}`);
  }

  throw lastError ?? new Error('Failed to create event after multiple attempts.');
}

async function createSingleEvent(
  event: CalendarEvent,
  timeZone: string,
): Promise<unknown> {
  const token = await getMicrosoftAuthToken();
  try {
    return await postEvent(event, token, timeZone);
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      const freshToken = await refreshMicrosoftAuthToken();
      return postEvent(event, freshToken, timeZone);
    }
    throw error;
  }
}

async function createEvents(events: CalendarEvent[]): Promise<CalendarResult> {
  if (events.length > MAX_EVENTS_PER_BATCH) {
    throw new Error(
      `Too many events to create (${events.length}). Maximum is ${MAX_EVENTS_PER_BATCH} per batch — please reduce the number of medications or shorten the durations.`,
    );
  }

  const initialToken = await getMicrosoftAuthToken();
  const timeZone = await getUserTimeZone(initialToken);
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    try {
      await createSingleEvent(event, timeZone);
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

export const microsoftCalendarProvider: CalendarProviderModule = {
  id: 'microsoft',
  createEvents,
};
