export interface MealTimes {
  cafe: string;    // HH:MM
  almoco: string;  // HH:MM
  jantar: string;  // HH:MM
  dormir: string;  // HH:MM
}

export interface ScheduledDose {
  medicationId: string;
  nome: string;
  dosagem: string;
  posologia: string;
  horario: string;  // HH:MM
  refeicaoRef: string;
  condicao: string;
  observacoes: string | null;
}

export interface MedicationSchedule {
  medicationId: string;
  nome: string;
  dosagem: string;
  doses: ScheduledDose[];
  duracao_dias: number | null;
  startDate: string;  // YYYY-MM-DD
  rrule: string;
}

export interface CalendarEvent {
  summary: string;
  description: string;
  startTime: string;  // ISO datetime
  endTime: string;    // ISO datetime
  recurrence: string[];
  colorId?: string;
  reminders: {
    useDefault: false;
    overrides: Array<{ method: 'popup' | 'email'; minutes: number }>;
  };
}
