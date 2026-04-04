import type { PrescriptionInput, ParsedPrescription } from '../../types/prescription';
import { PHARMACIST_PROMPT } from './prompt';
import { stripCodeFences } from './utils';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

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
  apiKey: string,
): Promise<ParsedPrescription> {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: buildParts(input) }],
    }),
  });

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
  try {
    const parsed: ParsedPrescription = JSON.parse(json);
    return parsed;
  } catch {
    throw new Error('AI returned invalid JSON. Try again or use a clearer prescription.');
  }
}
