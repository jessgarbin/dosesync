import type { PrescriptionInput, ParsedPrescription } from '../../types/prescription';
import type { Settings } from '../../types/settings';
import { PHARMACIST_PROMPT } from './prompt';
import { stripCodeFences, validateParsedPrescription } from './utils';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1/models';
const REQUEST_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 10_000;

function buildParts(input: PrescriptionInput) {
  const parts: Array<Record<string, unknown>> = [];

  if (input.type === 'text') {
    parts.push({ text: `${PHARMACIST_PROMPT}\n\nPrescription:\n${input.data}` });
  } else {
    const mimeType =
      input.type === 'pdf' ? 'application/pdf'
      : input.mimeType ?? 'image/jpeg';
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: input.data,
      },
    });
    parts.push({ text: PHARMACIST_PROMPT });
  }

  return parts;
}

export async function parsePrescription(
  input: PrescriptionInput,
  settings: Settings,
): Promise<ParsedPrescription> {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) throw new Error('Gemini API key not configured.');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: buildParts(input) }],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Gemini request timed out. Try again with a smaller image or simpler text.');
    }
    throw new Error(`Gemini request failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let detail = '';
    try {
      const errorJson = JSON.parse(errorText);
      detail = errorJson?.error?.message ?? errorText;
    } catch {
      detail = errorText;
    }
    throw new Error(`Gemini (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini. The prescription may be unreadable.');
  }

  const json = stripCodeFences(text);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('AI returned invalid JSON. Try again or use a clearer prescription.');
  }
  return validateParsedPrescription(raw);
}

/**
 * Validates the Gemini API key by calling the models list endpoint.
 * Free (doesn't consume tokens), fast, and returns 401/403 for bad keys.
 */
export async function testKey(settings: Settings): Promise<void> {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) throw new Error('Paste your Gemini API key first.');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    const response = await fetch(GEMINI_MODELS_URL, {
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey },
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid Gemini key. Check that you copied the whole value.');
    }
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini test failed (${response.status}): ${errorText || 'unknown error'}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Gemini test timed out. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
