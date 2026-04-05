import type { PrescriptionInput, ParsedPrescription } from '../../types/prescription';
import type { Settings } from '../../types/settings';
import { PHARMACIST_PROMPT } from './prompt';
import { stripCodeFences, validateParsedPrescription } from './utils';

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const REQUEST_TIMEOUT_MS = 60_000;

function buildContent(input: PrescriptionInput) {
  const content: Array<Record<string, unknown>> = [];

  if (input.type === 'text') {
    content.push({
      type: 'text',
      text: `Prescription:\n${input.data}`,
    });
  } else {
    const mediaType =
      input.type === 'pdf' ? 'application/pdf'
      : input.mimeType ?? 'image/jpeg';
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: input.data,
      },
    });
  }

  return content;
}

export async function parsePrescription(
  input: PrescriptionInput,
  settings: Settings,
): Promise<ParsedPrescription> {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) throw new Error('Claude API key not configured.');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: PHARMACIST_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildContent(input),
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude request timed out. Try again with a smaller image or simpler text.');
    }
    throw new Error(`Claude request failed: ${error instanceof Error ? error.message : String(error)}`);
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
    throw new Error(`Claude (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const textBlock = data?.content?.find(
    (block: { type: string }) => block.type === 'text',
  );

  if (!textBlock?.text) {
    throw new Error('Empty response from Claude. The prescription may be unreadable.');
  }

  const json = stripCodeFences(textBlock.text);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('AI returned invalid JSON. Try again or use a clearer prescription.');
  }
  return validateParsedPrescription(raw);
}
