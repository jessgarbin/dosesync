import type { Medication, FoodCondition } from '../types/medication';
import type { ScheduledDose, CalendarEvent, MealTimes } from '../types/schedule';

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function condLabel(cond: FoodCondition): string {
  switch (cond) {
    case 'jejum': return 'Fasting';
    case 'antes_refeicao': return 'Before meal';
    case 'com_refeicao': return 'With meal';
    case 'apos_refeicao': return 'After meal';
    case 'antes_dormir': return 'Before bed';
    case 'qualquer': return 'Any time';
  }
}

function generateIntervalTimes(
  intervalHours: number,
  startTime: string,
  label: string,
): { horario: string; refeicaoRef: string }[] {
  const [startH, startM] = startTime.split(':').map(Number) as [number, number];
  const results: { horario: string; refeicaoRef: string }[] = [];
  let mins = startH * 60 + startM;

  while (mins < 24 * 60) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    results.push({ horario: `${h}:${m}`, refeicaoRef: `Every ${intervalHours}h - ${label}` });
    mins += intervalHours * 60;
  }

  return results;
}

export function getTimesForFrequency(
  freq: Medication['frequencia'],
  condicao: FoodCondition,
  mealTimes: MealTimes,
): { horario: string; refeicaoRef: string }[] {
  const { cafe, almoco, jantar, dormir } = mealTimes;

  const offsetMin = (cond: FoodCondition, baseTime: string): string => {
    const [h, m] = baseTime.split(':').map(Number) as [number, number];
    let mins = h * 60 + m;

    switch (cond) {
      case 'jejum': mins = Math.max(0, mins - 60); break;
      case 'antes_refeicao': mins -= 30; break;
      case 'com_refeicao': break;
      case 'apos_refeicao': mins += 30; break;
      case 'antes_dormir': {
        const [dh, dm] = dormir.split(':').map(Number) as [number, number];
        mins = dh * 60 + dm - 30;
        break;
      }
      case 'qualquer': break;
    }

    if (mins < 0) mins = 0;
    const finalH = Math.floor(mins / 60).toString().padStart(2, '0');
    const finalM = (mins % 60).toString().padStart(2, '0');
    return `${finalH}:${finalM}`;
  };

  if (condicao === 'antes_dormir') {
    const time = offsetMin(condicao, dormir);
    const times = [{ horario: time, refeicaoRef: `Before bed (${dormir})` }];
    if (freq !== '1x_dia') {
      times.unshift({ horario: offsetMin('qualquer', cafe), refeicaoRef: `Breakfast (${cafe})` });
    }
    return times;
  }

  // cada_Xh: fixed interval — frequency determines the dose count (mandatory)
  // If breakfast doesn't allow all doses, shift start earlier
  {
    const intervalMap: Record<string, number> = {
      'cada_4h': 4, 'cada_6h': 6, 'cada_8h': 8, 'cada_12h': 12,
    };
    const intervalH = intervalMap[freq];
    if (intervalH) {
      const [cafeH, cafeM] = cafe.split(':').map(Number) as [number, number];
      const cafeMins = cafeH * 60 + cafeM;
      const expectedCount = Math.floor(24 / intervalH);
      const neededSpanMins = (expectedCount - 1) * intervalH * 60;
      let startMins = cafeMins;
      if (startMins + neededSpanMins >= 24 * 60) {
        startMins = Math.floor((24 * 60 - neededSpanMins - 1) / 15) * 15;
      }
      if (startMins < 0) startMins = 0;
      const sH = Math.floor(startMins / 60).toString().padStart(2, '0');
      const sM = (startMins % 60).toString().padStart(2, '0');
      return generateIntervalTimes(intervalH, `${sH}:${sM}`, condLabel(condicao));
    }
  }

  // qualquer + Nx_dia: distribute uniformly between wake and bedtime
  if (condicao === 'qualquer') {
    const countMap: Record<string, number> = {
      '1x_dia': 1, '2x_dia': 2, '3x_dia': 3, '4x_dia': 4,
    };
    const fixedCount = countMap[freq];
    if (fixedCount) {
      if (fixedCount === 1) return [{ horario: cafe, refeicaoRef: 'Morning' }];
      const [cafeH, cafeM] = cafe.split(':').map(Number) as [number, number];
      const [dormirH, dormirM] = dormir.split(':').map(Number) as [number, number];
      const cafeMins = cafeH * 60 + cafeM;
      const dormirMins = dormirH * 60 + dormirM;
      const interval = (dormirMins - cafeMins) / fixedCount;
      return Array.from({ length: fixedCount }, (_, i) => {
        const mins = Math.round(cafeMins + i * interval);
        const h = Math.floor(mins / 60).toString().padStart(2, '0');
        const m = (mins % 60).toString().padStart(2, '0');
        return { horario: `${h}:${m}`, refeicaoRef: `Dose ${i + 1} of ${fixedCount}` };
      });
    }
    return [{ horario: cafe, refeicaoRef: 'Morning' }];
  }

  // Meal condition + Nx_dia: anchor to meals
  const mealRefs = [
    { time: cafe, label: `Breakfast (${cafe})` },
    { time: almoco, label: `Lunch (${almoco})` },
    { time: jantar, label: `Dinner (${jantar})` },
    { time: dormir, label: `Bedtime (${dormir})` },
  ];

  switch (freq) {
    case '1x_dia':
      return [{ horario: offsetMin(condicao, cafe), refeicaoRef: mealRefs[0]!.label }];
    case '2x_dia':
      return [
        { horario: offsetMin(condicao, cafe), refeicaoRef: mealRefs[0]!.label },
        { horario: offsetMin(condicao, jantar), refeicaoRef: mealRefs[2]!.label },
      ];
    case '3x_dia':
      return [
        { horario: offsetMin(condicao, cafe), refeicaoRef: mealRefs[0]!.label },
        { horario: offsetMin(condicao, almoco), refeicaoRef: mealRefs[1]!.label },
        { horario: offsetMin(condicao, jantar), refeicaoRef: mealRefs[2]!.label },
      ];
    case '4x_dia':
      return [
        { horario: offsetMin(condicao, cafe), refeicaoRef: mealRefs[0]!.label },
        { horario: offsetMin(condicao, almoco), refeicaoRef: mealRefs[1]!.label },
        { horario: offsetMin(condicao, jantar), refeicaoRef: mealRefs[2]!.label },
        { horario: offsetMin(condicao, dormir), refeicaoRef: mealRefs[3]!.label },
      ];
    default:
      return [{ horario: cafe, refeicaoRef: mealRefs[0]!.label }];
  }
}

export function getIntervalHours(freq: Medication['frequencia'] | undefined): number | null {
  switch (freq) {
    case 'cada_4h': return 4;
    case 'cada_6h': return 6;
    case 'cada_8h': return 8;
    case 'cada_12h': return 12;
    default: return null;
  }
}

export function buildDosesFromMedications(
  medications: Medication[],
  mealTimes: MealTimes,
): ScheduledDose[] {
  const allDoses: ScheduledDose[] = [];

  for (const med of medications) {
    const times = getTimesForFrequency(med.frequencia, med.condicao, mealTimes);
    const medDoses: ScheduledDose[] = times.map(t => ({
      medicationId: med.id,
      nome: med.nome,
      dosagem: med.dosagem,
      posologia: med.posologia,
      horario: t.horario,
      refeicaoRef: t.refeicaoRef,
      condicao: med.condicao,
      observacoes: med.observacoes,
    }));
    allDoses.push(...medDoses);
  }

  allDoses.sort((a, b) => a.horario.localeCompare(b.horario));
  return allDoses;
}

export function buildCalendarEventsFromDoses(
  doses: ScheduledDose[],
  medications: Medication[],
  startDate: string,
  reminderMinutes = 10,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const durationMap = new Map(medications.map(m => [m.id, m.duracao_dias]));
  const today = formatDate(new Date());
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (const dose of doses) {
    const [h, m] = dose.horario.split(':').map(Number) as [number, number];
    const doseMins = h * 60 + m;
    const duracao = durationMap.get(dose.medicationId);

    let effectiveDate = startDate;
    let effectiveCount = duracao;
    if (startDate === today && doseMins <= nowMins) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      effectiveDate = formatDate(tomorrow);
      if (effectiveCount != null) {
        effectiveCount = effectiveCount - 1;
        if (effectiveCount <= 0) continue;
      }
    }

    const startISO = `${effectiveDate}T${dose.horario}:00`;
    let endMins = doseMins + 15;
    let endDate = effectiveDate;
    if (endMins >= 24 * 60) {
      endMins -= 24 * 60;
      const next = new Date(effectiveDate);
      next.setDate(next.getDate() + 1);
      endDate = formatDate(next);
    }
    const endH = Math.floor(endMins / 60).toString().padStart(2, '0');
    const endM = (endMins % 60).toString().padStart(2, '0');
    const endISO = `${endDate}T${endH}:${endM}:00`;

    const recurrence: string[] = [];
    if (effectiveCount) {
      recurrence.push(`RRULE:FREQ=DAILY;COUNT=${effectiveCount}`);
    }

    const dosagemPart = dose.dosagem ? ` ${dose.dosagem}` : '';
    const posologiaPart = dose.posologia ? ` - ${dose.posologia}` : '';

    events.push({
      summary: `\uD83D\uDC8A ${dose.nome}${dosagemPart}${posologiaPart}`,
      description: [
        dose.refeicaoRef,
        dose.condicao,
        dose.observacoes,
      ].filter(Boolean).join('\n'),
      startTime: startISO,
      endTime: endISO,
      recurrence,
      reminders: {
        useDefault: false as const,
        overrides: [{ method: 'popup' as const, minutes: reminderMinutes }],
      },
    });
  }

  return events;
}
