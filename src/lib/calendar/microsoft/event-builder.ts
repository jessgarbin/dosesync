import type { CalendarEvent } from '../../../types/schedule';

/**
 * Microsoft Graph recurrence object (pattern + range).
 * Only the `daily` pattern with a `numbered` range is emitted here because
 * that's the only flavor of RRULE the app generates today.
 */
export interface MSRecurrence {
  pattern: {
    type: 'daily';
    interval: number;
  };
  range: {
    type: 'numbered';
    startDate: string; // YYYY-MM-DD
    numberOfOccurrences: number;
  };
}

/**
 * Payload shape accepted by POST /me/events on Microsoft Graph.
 * Only the fields DoseSync actually sets are modeled — everything else
 * uses Graph defaults.
 */
export interface MSEvent {
  subject: string;
  body: {
    contentType: 'text';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isReminderOn: boolean;
  reminderMinutesBeforeStart: number;
  recurrence?: MSRecurrence;
}

/**
 * Parses an RRULE string like "RRULE:FREQ=DAILY;COUNT=7" into a plain
 * { FREQ, COUNT } map. Returns null if the input cannot be parsed.
 *
 * Exported for unit tests.
 */
export function parseRRule(rrule: string): Record<string, string> | null {
  const match = rrule.match(/^RRULE:(.*)$/);
  if (!match) return null;
  const parts = match[1]!.split(';').filter(Boolean);
  const out: Record<string, string> = {};
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) out[key] = value;
  }
  return out;
}

/**
 * Translates the neutral recurrence[] (Google-style RRULE strings) into
 * the Microsoft Graph recurrence object. Returns undefined when no rule
 * applies (single occurrence).
 *
 * Exported for unit tests.
 */
export function buildMSRecurrence(
  recurrence: string[] | undefined,
  startDate: string,
): MSRecurrence | undefined {
  if (!recurrence?.length) return undefined;

  const rule = parseRRule(recurrence[0]!);
  if (!rule) return undefined;

  // Only DAILY is emitted by the app's schedule-utils today.
  if (rule['FREQ'] !== 'DAILY') return undefined;

  const count = parseInt(rule['COUNT'] ?? '', 10);
  if (!Number.isFinite(count) || count <= 0) return undefined;

  const interval = parseInt(rule['INTERVAL'] ?? '1', 10);

  return {
    pattern: {
      type: 'daily',
      interval: Number.isFinite(interval) && interval > 0 ? interval : 1,
    },
    range: {
      type: 'numbered',
      startDate,
      numberOfOccurrences: count,
    },
  };
}

/**
 * Extracts "YYYY-MM-DD" from an ISO datetime like "2026-04-05T07:00:00".
 * Exported for unit tests.
 */
export function extractDate(iso: string): string {
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1]! : iso;
}

/**
 * Converts a neutral CalendarEvent into the Microsoft Graph event schema.
 *
 * Differences from Google that this function handles:
 * - summary → subject
 * - description → body.content (with contentType)
 * - recurrence RRULE strings → recurrence object with pattern + range
 * - reminders.overrides[] (multi) → reminderMinutesBeforeStart (single)
 *   Graph only supports a single reminder per event, so we take the
 *   minimum minutes value to be safe (earliest reminder wins).
 * - colorId has no direct equivalent and is dropped.
 */
export function toMSEvent(event: CalendarEvent, timeZone: string): MSEvent {
  const startDate = extractDate(event.startTime);

  // Reminder: pick the first override, fall back to 10 minutes.
  const firstReminder = event.reminders?.overrides?.[0]?.minutes;
  const reminderMinutes =
    typeof firstReminder === 'number' && Number.isFinite(firstReminder) && firstReminder >= 0
      ? Math.floor(firstReminder)
      : 10;

  const msEvent: MSEvent = {
    subject: event.summary,
    body: {
      contentType: 'text',
      content: event.description ?? '',
    },
    start: {
      dateTime: event.startTime,
      timeZone,
    },
    end: {
      dateTime: event.endTime,
      timeZone,
    },
    isReminderOn: true,
    reminderMinutesBeforeStart: reminderMinutes,
  };

  const rec = buildMSRecurrence(event.recurrence, startDate);
  if (rec) {
    msEvent.recurrence = rec;
  }

  return msEvent;
}
