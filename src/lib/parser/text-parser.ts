import type { Medication, Frequency, FoodCondition } from '../../types/medication';

type Lang = 'pt' | 'en';

interface ParsedLine {
  nome: string;       // name + concentration (e.g. "Amoxicilina 500mg")
  dosagem: string;    // amount per dose (e.g. "1 cápsula")
  frequencia: Frequency;
  duracao_dias: number | null;
  condicao: FoodCondition;
  observacoes: string | null;
}

// Regex patterns — bilingual (Portuguese and English)
// Units are international so a single pattern works.
const DOSAGEM_RE = /\b(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|ui|iu|%|gotas?|drops?))\b/i;

// Pharmaceutical forms (PT + EN). Captures quantity and unit in one shot.
// Order matters: longer/more specific forms first so "capsules" wins over "caps".
const POSOLOGIA_RE = /\b(\d+)\s*(comprimidos?|c[aá]psulas?|capsules?|tablets?|pills?|doses?|gotas?|drops?|sach[eê]s?|sachets?|ampolas?|ampoules?|dr[aá]geas?|dragees?|ml|cp|caps?)\b/i;

// Duration (PT "por X dias" / EN "for X days")
const DURACAO_RE = /\b(?:por|durante|for|during)?\s*(\d+)\s*(?:dias?|days?)\b/i;

const FREQUENCIA_MAP: [RegExp, Frequency][] = [
  // Every Xh — PT + EN + medical abbreviations (q4h, q6h, etc.)
  [/\b(?:cada|de)?\s*4\s*(?:em\s*4\s*)?h(?:oras?|ours?)?\b/i, 'cada_4h'],
  [/\bevery\s+4\s*(?:h(?:ours?)?)?\b/i, 'cada_4h'],
  [/\bq\s*4\s*h\b/i, 'cada_4h'],
  [/\b(?:cada|de)?\s*6\s*(?:em\s*6\s*)?h(?:oras?|ours?)?\b/i, 'cada_6h'],
  [/\bevery\s+6\s*(?:h(?:ours?)?)?\b/i, 'cada_6h'],
  [/\bq\s*6\s*h\b/i, 'cada_6h'],
  [/\b(?:cada|de)?\s*8\s*(?:em\s*8\s*)?h(?:oras?|ours?)?\b/i, 'cada_8h'],
  [/\bevery\s+8\s*(?:h(?:ours?)?)?\b/i, 'cada_8h'],
  [/\bq\s*8\s*h\b/i, 'cada_8h'],
  [/\b(?:cada|de)?\s*12\s*(?:em\s*12\s*)?h(?:oras?|ours?)?\b/i, 'cada_12h'],
  [/\bevery\s+12\s*(?:h(?:ours?)?)?\b/i, 'cada_12h'],
  [/\bq\s*12\s*h\b/i, 'cada_12h'],
  // N times/day — numeric form (PT "3x ao dia" / EN "3 times a day")
  [/\b4\s*(?:x|vezes|times?)\s*(?:a|ao|per)?\s*(?:dia|day|daily)/i, '4x_dia'],
  [/\b3\s*(?:x|vezes|times?)\s*(?:a|ao|per)?\s*(?:dia|day|daily)/i, '3x_dia'],
  [/\b2\s*(?:x|vezes|times?)\s*(?:a|ao|per)?\s*(?:dia|day|daily)/i, '2x_dia'],
  [/\b1\s*(?:x|vez|time)\s*(?:a|ao|per)?\s*(?:dia|day|daily)/i, '1x_dia'],
  // N times/day — spelled out in English
  [/\bfour\s+times\s+(?:a\s+day|daily)\b/i, '4x_dia'],
  [/\bthree\s+times\s+(?:a\s+day|daily)\b/i, '3x_dia'],
  [/\btwice\s+(?:a\s+day|daily)\b/i, '2x_dia'],
  [/\bonce\s+(?:a\s+day|daily)\b/i, '1x_dia'],
  // Latin medical abbreviations (must be checked before single-letter matches)
  [/\bqid\b/i, '4x_dia'],
  [/\btid\b/i, '3x_dia'],
  [/\bbid\b/i, '2x_dia'],
  [/\bqd\b/i, '1x_dia'],
];

const CONDICAO_MAP: [RegExp, FoodCondition][] = [
  // Fasting / empty stomach
  [/\bem\s*jejum\b/i, 'jejum'],
  [/\bfasting\b/i, 'jejum'],
  [/\bon\s+(?:an\s+)?empty\s+stomach\b/i, 'jejum'],
  // Before meal
  [/\bantes\s*(?:da|de)?\s*refei[çc][ãa]o\b/i, 'antes_refeicao'],
  [/\bbefore\s+(?:a\s+)?meals?\b/i, 'antes_refeicao'],
  [/\bac\b/i, 'antes_refeicao'], // "ante cibum" medical abbreviation
  // With food
  [/\bcom\s*(?:a\s*)?(?:comida|refei[çc][ãa]o|alimento)\b/i, 'com_refeicao'],
  [/\bwith\s+(?:food|meals?)\b/i, 'com_refeicao'],
  // After meal
  [/\bap[oó]s\s*(?:a\s*)?(?:comida|refei[çc][ãa]o|alimento|caf[eé])\b/i, 'apos_refeicao'],
  [/\bdepois\s*(?:da|de)?\s*(?:comida|refei[çc][ãa]o)\b/i, 'apos_refeicao'],
  [/\bafter\s+(?:a\s+)?meals?\b/i, 'apos_refeicao'],
  [/\bpc\b/i, 'apos_refeicao'], // "post cibum" medical abbreviation
  // Before bed / at night
  [/\bantes\s*de\s*dormir\b/i, 'antes_dormir'],
  [/\b[àa]\s*noite\b/i, 'antes_dormir'],
  [/\bbefore\s+bed(?:time)?\b/i, 'antes_dormir'],
  [/\bat\s+bedtime\b/i, 'antes_dormir'],
  [/\bat\s+night\b/i, 'antes_dormir'],
  [/\bhs\b/i, 'antes_dormir'], // "hora somni" medical abbreviation
];

const SOS_RE = /\b(?:se\s+necess[aá]rio|quando\s+necess[aá]rio|em\s+caso\s+de\s+dor|se\s+dor|sos|s[\/]?n|as\s+needed|if\s+needed|when\s+needed|prn)\b/i;

function detectLanguage(text: string): Lang {
  const ptRe = /\b(tomar|ao\s+dia|em\s+jejum|comprimidos?|c[aá]psulas?|por\s+\d+\s+dias?|de\s+\d+\s+em\s+\d+|vezes|refei[çc][ãa]o|antes|ap[oó]s|dormir|se\s+dor|se\s+necess[aá]rio)\b/gi;
  const enRe = /\b(take|daily|fasting|tablets?|capsules?|for\s+\d+\s+days?|every\s+\d+|times?\s+a\s+day|before\s+meal|after\s+meal|as\s+needed|bedtime)\b/gi;
  const ptCount = (text.match(ptRe) || []).length;
  const enCount = (text.match(enRe) || []).length;
  return ptCount >= enCount ? 'pt' : 'en';
}

// Pharmaceutical form maps per language
const FORM_PT: Record<string, [string, string]> = {
  'cp': ['cápsula', 'cápsulas'],
  'cap': ['cápsula', 'cápsulas'],
  'caps': ['cápsula', 'cápsulas'],
  'capsule': ['cápsula', 'cápsulas'],
  'capsules': ['cápsula', 'cápsulas'],
  'capsula': ['cápsula', 'cápsulas'],
  'capsulas': ['cápsula', 'cápsulas'],
  'cápsula': ['cápsula', 'cápsulas'],
  'cápsulas': ['cápsula', 'cápsulas'],
  'comprimido': ['comprimido', 'comprimidos'],
  'comprimidos': ['comprimido', 'comprimidos'],
  'tablet': ['comprimido', 'comprimidos'],
  'tablets': ['comprimido', 'comprimidos'],
  'pill': ['comprimido', 'comprimidos'],
  'pills': ['comprimido', 'comprimidos'],
  'dose': ['dose', 'doses'],
  'doses': ['dose', 'doses'],
  'gota': ['gota', 'gotas'],
  'gotas': ['gota', 'gotas'],
  'drop': ['gota', 'gotas'],
  'drops': ['gota', 'gotas'],
  'sache': ['sachê', 'sachês'],
  'saches': ['sachê', 'sachês'],
  'sachê': ['sachê', 'sachês'],
  'sachês': ['sachê', 'sachês'],
  'sachet': ['sachê', 'sachês'],
  'sachets': ['sachê', 'sachês'],
  'ampola': ['ampola', 'ampolas'],
  'ampolas': ['ampola', 'ampolas'],
  'ampoule': ['ampola', 'ampolas'],
  'ampoules': ['ampola', 'ampolas'],
  'dragea': ['drágea', 'drágeas'],
  'drageas': ['drágea', 'drágeas'],
  'drágea': ['drágea', 'drágeas'],
  'drágeas': ['drágea', 'drágeas'],
  'dragee': ['drágea', 'drágeas'],
  'dragees': ['drágea', 'drágeas'],
  'ml': ['ml', 'ml'],
};

const FORM_EN: Record<string, [string, string]> = {
  'cp': ['capsule', 'capsules'],
  'cap': ['capsule', 'capsules'],
  'caps': ['capsule', 'capsules'],
  'capsule': ['capsule', 'capsules'],
  'capsules': ['capsule', 'capsules'],
  'capsula': ['capsule', 'capsules'],
  'capsulas': ['capsule', 'capsules'],
  'cápsula': ['capsule', 'capsules'],
  'cápsulas': ['capsule', 'capsules'],
  'comprimido': ['tablet', 'tablets'],
  'comprimidos': ['tablet', 'tablets'],
  'tablet': ['tablet', 'tablets'],
  'tablets': ['tablet', 'tablets'],
  'pill': ['pill', 'pills'],
  'pills': ['pill', 'pills'],
  'dose': ['dose', 'doses'],
  'doses': ['dose', 'doses'],
  'gota': ['drop', 'drops'],
  'gotas': ['drop', 'drops'],
  'drop': ['drop', 'drops'],
  'drops': ['drop', 'drops'],
  'sache': ['sachet', 'sachets'],
  'saches': ['sachet', 'sachets'],
  'sachê': ['sachet', 'sachets'],
  'sachês': ['sachet', 'sachets'],
  'sachet': ['sachet', 'sachets'],
  'sachets': ['sachet', 'sachets'],
  'ampola': ['ampoule', 'ampoules'],
  'ampolas': ['ampoule', 'ampoules'],
  'ampoule': ['ampoule', 'ampoules'],
  'ampoules': ['ampoule', 'ampoules'],
  'dragea': ['dragee', 'dragees'],
  'drageas': ['dragee', 'dragees'],
  'drágea': ['dragee', 'dragees'],
  'drágeas': ['dragee', 'dragees'],
  'dragee': ['dragee', 'dragees'],
  'dragees': ['dragee', 'dragees'],
  'ml': ['ml', 'ml'],
};

function parseLine(line: string, lang: Lang): ParsedLine | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return null;

  // Concentration (e.g. "500mg") — will be appended to the name
  const concMatch = trimmed.match(DOSAGEM_RE);
  const concentration = concMatch?.[1] ?? '';

  // Dosage = pharmaceutical form + quantity (e.g. "1 cápsula")
  const formMatch = trimmed.match(POSOLOGIA_RE);
  let dosagem = '';
  if (formMatch) {
    const qty = formMatch[1]!;
    const raw = formMatch[2]!.toLowerCase();
    const plural = qty !== '1';
    const formMap = lang === 'pt' ? FORM_PT : FORM_EN;
    const mapped = formMap[raw];
    const form = mapped ? mapped[plural ? 1 : 0] : raw;
    dosagem = `${qty} ${form}`;
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
    observacoes = lang === 'pt' ? 'Se necessário (SOS)' : 'As needed (SOS)';
  }

  // Name: everything before the concentration, with concentration appended
  let nome = '';
  if (concMatch?.index != null && concMatch.index > 0) {
    nome = trimmed.slice(0, concMatch.index).trim();
  }
  if (!nome) {
    const STOP_WORDS = /^(de|em|por|ao|da|com|antes|ap[oó]s|dia|dias|hora|horas|vezes|vez|cada|c[aá]psulas?|comprimidos?|gotas?|of|in|for|to|the|with|before|after|day|days|hour|hours|times?|every|tablets?|pills?|capsules?|drops?|daily|fasting|on|empty|stomach|bed|bedtime|night|needed|as)$/i;
    const words = trimmed.split(/[\s\-,]+/);
    const nameWords: string[] = [];
    for (const w of words) {
      if (/^\d/.test(w) || DOSAGEM_RE.test(w) || STOP_WORDS.test(w)) break;
      nameWords.push(w);
    }
    nome = nameWords.join(' ');
  }
  nome = nome.replace(/[-–—,;:]+$/, '').trim();

  if (!nome) return null;

  // Append concentration to the name (e.g. "Amoxicilina" + "500mg" → "Amoxicilina 500mg")
  if (concentration) {
    nome = `${nome} ${concentration}`;
  }

  return { nome, dosagem, frequencia, duracao_dias, condicao, observacoes };
}

export function parseTextPrescription(text: string): Medication[] {
  const lang = detectLanguage(text);

  const lines = text
    .split(/\n|;/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const medications: Medication[] = [];

  for (const line of lines) {
    const parsed = parseLine(line, lang);
    if (parsed) {
      medications.push({
        id: `med_${Date.now()}_${medications.length}`,
        ...parsed,
        lang,
      });
    }
  }

  return medications;
}
