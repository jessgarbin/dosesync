import type { PrescriptionInput, ParsedPrescription } from '../../types/prescription';
import type { Settings } from '../../types/settings';
import { PHARMACIST_PROMPT } from './prompt';
import { stripCodeFences, validateParsedPrescription } from './utils';

// OpenRouter exposes an OpenAI-compatible Chat Completions endpoint that
// proxies ~150 models (OpenAI, Anthropic, Google, Mistral, Llama, etc.).
// Using it as a meta-provider lets users pick any vision-capable model
// without the extension shipping a new adapter per vendor.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 60_000;

function buildMessages(input: PrescriptionInput): Array<Record<string, unknown>> {
  if (input.type === 'text') {
    return [
      { role: 'system', content: PHARMACIST_PROMPT },
      { role: 'user', content: `Prescription:\n${input.data}` },
    ];
  }

  // Vision: OpenRouter follows OpenAI's vision message format.
  // PDFs are accepted as data URLs by models that support documents
  // (e.g. Gemini, Claude). Text-only models will return an error the
  // caller surfaces.
  const mimeType =
    input.type === 'pdf' ? 'application/pdf'
    : input.mimeType ?? 'image/jpeg';
  const dataUrl = `data:${mimeType};base64,${input.data}`;

  return [
    { role: 'system', content: PHARMACIST_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Extract the prescription below.' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ];
}

export async function parsePrescription(
  input: PrescriptionInput,
  settings: Settings,
): Promise<ParsedPrescription> {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) throw new Error('OpenRouter API key not configured.');

  const model = settings.openrouterModel.trim();
  if (!model) {
    throw new Error(
      'OpenRouter model not configured. Set a model slug like "google/gemini-2.0-flash-exp:free" in settings.',
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter recommends identifying the caller for analytics and
        // free-tier attribution. These headers are optional but polite.
        'HTTP-Referer': 'https://github.com/jessgarbin/dosesync',
        'X-Title': 'DoseSync',
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(input),
        // Force JSON to reduce chances of prose wrapping the payload.
        response_format: { type: 'json_object' },
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenRouter request timed out. Try again with a smaller image or simpler text.');
    }
    throw new Error(`OpenRouter request failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let detail = '';
    try {
      const errorJson = JSON.parse(errorText);
      detail = errorJson?.error?.message ?? errorJson?.error ?? errorText;
    } catch {
      detail = errorText;
    }
    throw new Error(`OpenRouter (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (typeof text !== 'string' || !text) {
    throw new Error('Empty response from OpenRouter. The prescription may be unreadable or the model may not support vision.');
  }

  const json = stripCodeFences(text);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('AI returned invalid JSON. Try again or switch to a model with stronger JSON output (e.g., gpt-4o-mini).');
  }
  return validateParsedPrescription(raw);
}
