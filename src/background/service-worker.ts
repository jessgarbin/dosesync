import type { PrescriptionInput } from '../types/prescription';
import type { CalendarEvent } from '../types/schedule';
import type { Settings } from '../types/settings';
import { getAIProvider } from '../lib/ai/index';
import { getAuthToken, refreshAuthToken } from '../lib/calendar/auth';
import { createEvents } from '../lib/calendar/client';
import { getSettings, saveSettings } from '../lib/storage/index';

type MessageAction = 'parse-prescription' | 'create-events' | 'get-settings' | 'save-settings';

interface Message {
  action: MessageAction;
  payload?: unknown;
}

let lastParseTs = 0;
const PARSE_COOLDOWN_MS = 3000;

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized sender.' });
    return;
  }

  handleMessage(message)
    .then(sendResponse)
    .catch((error) =>
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error.',
      }),
    );
  return true; // keep channel open for async response
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.action) {
    case 'parse-prescription':
      return handleParsePrescription(message.payload as PrescriptionInput);

    case 'create-events':
      return handleCreateEvents(message.payload as CalendarEvent[]);

    case 'get-settings':
      return handleGetSettings();

    case 'save-settings':
      return handleSaveSettings(message.payload as Partial<Settings>);

    default:
      throw new Error(`Unknown action: ${message.action}`);
  }
}

async function handleParsePrescription(input: PrescriptionInput) {
  const now = Date.now();
  if (now - lastParseTs < PARSE_COOLDOWN_MS) {
    throw new Error('Please wait a few seconds before trying again.');
  }
  lastParseTs = now;

  const settings = await getSettings();
  const apiKey = settings.apiKey;

  if (!apiKey) {
    throw new Error(
      `${settings.aiProvider === 'gemini' ? 'Gemini' : 'Claude'} API key not configured. Go to the extension settings.`,
    );
  }

  const provider = getAIProvider(settings.aiProvider);
  const result = await provider.parsePrescription(input, apiKey);

  return { success: true, data: result };
}

async function handleCreateEvents(events: CalendarEvent[]) {
  if (!events?.length) {
    throw new Error('No events to create.');
  }

  const result = await createEvents(events, getAuthToken, refreshAuthToken);

  return { success: true, data: result };
}

async function handleGetSettings() {
  const settings = await getSettings();
  return { success: true, data: settings };
}

async function handleSaveSettings(partial: Partial<Settings>) {
  const settings = await saveSettings(partial);
  return { success: true, data: settings };
}
