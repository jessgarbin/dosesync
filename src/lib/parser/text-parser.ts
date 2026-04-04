import type { Medication, Frequency, FoodCondition } from '../../types/medication';

interface ParsedLine {
  nome: string;
  dosagem: string;
  posologia: string;
  frequencia: Frequency;
  duracao_dias: number | null;
  condicao: FoodCondition;
  observacoes: string | null;
}

// Regex patterns (Portuguese — parses Brazilian prescriptions)
const DOSAGEM_RE = /\b(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|ui|%|gotas?))\b/i;
const POSOLOGIA_RE = /\b(\d+)\s*(comprimido|comprimidos|capsula|capsulas|cp|caps?|gota|gotas|ml|sachê|sachês|ampola|ampolas|drágea|drágeas)\b/i;
const DURACAO_RE = /\b(?:por\s+)?(\d+)\s*dias?\b/i;

const FREQUENCIA_MAP: [RegExp, Frequency][] = [
  [/\b4[\/h]\s*(?:em\s*)?4\s*h/i, 'cada_4h'],
  [/\bde\s+4\s+em\s+4\s+h/i, 'cada_4h'],
  [/\bcada\s+4\s*h/i, 'cada_4h'],
  [/\b6[\/h]\s*(?:em\s*)?6\s*h/i, 'cada_6h'],
  [/\bde\s+6\s+em\s+6\s+h/i, 'cada_6h'],
  [/\bcada\s+6\s*h/i, 'cada_6h'],
  [/\b8[\/h]\s*(?:em\s*)?8\s*h/i, 'cada_8h'],
  [/\bde\s+8\s+em\s+8\s+h/i, 'cada_8h'],
  [/\bcada\s+8\s*h/i, 'cada_8h'],
  [/\b12[\/h]\s*(?:em\s*)?12\s*h/i, 'cada_12h'],
  [/\bde\s+12\s+em\s+12\s+h/i, 'cada_12h'],
  [/\bcada\s+12\s*h/i, 'cada_12h'],
  [/\b4\s*(?:x|vezes)\s*(?:ao\s*)?dia/i, '4x_dia'],
  [/\b3\s*(?:x|vezes)\s*(?:ao\s*)?dia/i, '3x_dia'],
  [/\b2\s*(?:x|vezes)\s*(?:ao\s*)?dia/i, '2x_dia'],
  [/\b1\s*(?:x|vez)\s*(?:ao\s*)?dia/i, '1x_dia'],
];

const CONDICAO_MAP: [RegExp, FoodCondition][] = [
  [/\bem\s*jejum\b/i, 'jejum'],
  [/\bantes\s*(?:da|de)?\s*refei[çc][ãa]o\b/i, 'antes_refeicao'],
  [/\bcom\s*(?:a\s*)?(?:comida|refei[çc][ãa]o|alimento)\b/i, 'com_refeicao'],
  [/\bap[oó]s\s*(?:a\s*)?(?:comida|refei[çc][ãa]o|alimento)\b/i, 'apos_refeicao'],
  [/\bdepois\s*(?:da|de)?\s*(?:comida|refei[çc][ãa]o)\b/i, 'apos_refeicao'],
  [/\bantes\s*de\s*dormir\b/i, 'antes_dormir'],
  [/\b[àa]\s*noite\b/i, 'antes_dormir'],
];

const SOS_RE = /\b(?:se\s+necess[aá]rio|sos|em\s+caso\s+de\s+dor|quando\s+necess[aá]rio|s[\/]?n)\b/i;

function parseLine(line: string): ParsedLine | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return null;

  // Dosage
  const dosagemMatch = trimmed.match(DOSAGEM_RE);
  const dosagem = dosagemMatch?.[1] ?? '';

  // Instructions
  const posologiaMatch = trimmed.match(POSOLOGIA_RE);
  let posologia = '1 tablet';
  if (posologiaMatch) {
    const qty = posologiaMatch[1];
    let form = posologiaMatch[2]!.toLowerCase();
    // Normalize abbreviated forms
    if (form === 'cp' || form === 'cap' || form === 'caps') form = qty === '1' ? 'capsule' : 'capsules';
    posologia = `${qty} ${form}`;
  }

  // Frequency
  let frequencia: Frequency = '1x_dia';
  for (const [re, freq] of FREQUENCIA_MAP) {
    if (re.test(trimmed)) {
      frequencia = freq;
      break;
    }
  }

  // Duration
  const duracaoMatch = trimmed.match(DURACAO_RE);
  const duracao_dias = duracaoMatch ? parseInt(duracaoMatch[1]!, 10) : null;

  // Meal condition
  let condicao: FoodCondition = 'qualquer';
  for (const [re, cond] of CONDICAO_MAP) {
    if (re.test(trimmed)) {
      condicao = cond;
      break;
    }
  }

  // SOS
  const isSOS = SOS_RE.test(trimmed);
  let observacoes: string | null = null;
  if (isSOS) {
    frequencia = '1x_dia';
    observacoes = 'As needed (SOS)';
  }

  // Name: everything before the dosage/numbers, or the first significant words
  let nome = '';
  if (dosagemMatch?.index != null && dosagemMatch.index > 0) {
    nome = trimmed.slice(0, dosagemMatch.index).trim();
  }
  if (!nome) {
    // Take the first words that aren't numbers/units
    const words = trimmed.split(/[\s\-,]+/);
    const nameWords: string[] = [];
    for (const w of words) {
      if (/^\d/.test(w) || DOSAGEM_RE.test(w) || /^(de|em|por|ao|da|com|antes|após|dia|dias|hora|horas|vezes|vez|cada|capsula|comprimido|gotas?)$/i.test(w)) break;
      nameWords.push(w);
    }
    nome = nameWords.join(' ');
  }
  // Remove trailing dashes and punctuation
  nome = nome.replace(/[-–—,;:]+$/, '').trim();

  if (!nome) return null;

  return { nome, dosagem, posologia, frequencia, duracao_dias, condicao, observacoes };
}

export function parseTextPrescription(text: string): Medication[] {
  const lines = text
    .split(/\n|;/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const medications: Medication[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) {
      medications.push({
        id: `med_${Date.now()}_${medications.length}`,
        ...parsed,
      });
    }
  }

  return medications;
}
