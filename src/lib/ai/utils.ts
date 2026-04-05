import type { ParsedPrescription } from '../../types/prescription';
import type { Frequency, FoodCondition } from '../../types/medication';

/**
 * Remove markdown code fences (```json ... ```) que modelos de IA
 * frequentemente adicionam ao redor do JSON.
 */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}

// Hard cap on how many medications we accept from a single prescription.
// Protects against AI hallucination, malformed responses, and absurdly long
// prescriptions that would slow down the UI and spam Calendar API.
export const MAX_MEDICATIONS = 30;

const VALID_FREQUENCIES: readonly Frequency[] = [
  '1x_dia', '2x_dia', '3x_dia', '4x_dia',
  'cada_4h', 'cada_6h', 'cada_8h', 'cada_12h',
];

const VALID_CONDITIONS: readonly FoodCondition[] = [
  'jejum', 'antes_refeicao', 'com_refeicao', 'apos_refeicao', 'antes_dormir', 'qualquer',
];

function coerceString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return fallback;
}

function coerceDuration(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    // "7 dias", "7-10", "around 7" → tenta extrair primeiro inteiro positivo
    const match = value.match(/\d+/);
    if (match) {
      const n = parseInt(match[0], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function coerceFrequency(value: unknown): Frequency {
  if (typeof value === 'string' && (VALID_FREQUENCIES as readonly string[]).includes(value)) {
    return value as Frequency;
  }
  return '1x_dia';
}

function coerceCondition(value: unknown): FoodCondition {
  if (typeof value === 'string' && (VALID_CONDITIONS as readonly string[]).includes(value)) {
    return value as FoodCondition;
  }
  return 'qualquer';
}

/**
 * Validates and normalizes an arbitrary AI response into a ParsedPrescription.
 * Tolerates missing fields, wrong types, and invalid enum values by applying
 * safe defaults. Throws only if the top-level shape is completely unusable.
 */
export function validateParsedPrescription(raw: unknown): ParsedPrescription {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI returned an invalid response shape.');
  }

  const obj = raw as Record<string, unknown>;
  // Some models may use alternate keys; prefer the canonical one.
  const list = obj['medicamentos'] ?? obj['medications'] ?? obj['meds'];

  if (!Array.isArray(list)) {
    throw new Error('AI response missing "medicamentos" array.');
  }

  const medicamentos = list
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map((m, i) => ({
      id: `med_${Date.now()}_${i}`,
      nome: coerceString(m['nome'] ?? m['name']),
      dosagem: coerceString(m['dosagem'] ?? m['dosage']),
      posologia: coerceString(m['posologia'] ?? m['instructions'], '1 tablet'),
      frequencia: coerceFrequency(m['frequencia'] ?? m['frequency']),
      duracao_dias: coerceDuration(m['duracao_dias'] ?? m['duration_days']),
      condicao: coerceCondition(m['condicao'] ?? m['condition']),
      observacoes: (() => {
        const v = m['observacoes'] ?? m['notes'];
        const s = coerceString(v);
        return s ? s : null;
      })(),
    }))
    // Drop entries with completely empty name — useless downstream
    .filter((m) => m.nome.length > 0);

  if (medicamentos.length > MAX_MEDICATIONS) {
    throw new Error(
      `Too many medications detected (${medicamentos.length}). Maximum is ${MAX_MEDICATIONS} per prescription — please split into multiple prescriptions.`,
    );
  }

  return { medicamentos };
}
