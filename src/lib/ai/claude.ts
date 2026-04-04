import type { PrescriptionInput, ParsedPrescription } from '../../types/prescription';
import { PHARMACIST_PROMPT } from './prompt';
import { stripCodeFences } from './utils';

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

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
  apiKey: string,
): Promise<ParsedPrescription> {
  const response = await fetch(CLAUDE_URL, {
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
  try {
    const parsed: ParsedPrescription = JSON.parse(json);
    return parsed;
  } catch {
    throw new Error('AI returned invalid JSON. Try again or use a clearer prescription.');
  }
}
