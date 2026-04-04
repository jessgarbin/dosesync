import type { MealTimes } from './schedule';

export type AIProvider = 'gemini' | 'claude';

export interface Settings {
  aiProvider: AIProvider;
  apiKey: string;
  mealTimes: MealTimes;
  reminderMinutesBefore: number;
}

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'gemini',
  apiKey: '',
  mealTimes: {
    cafe: '07:00',
    almoco: '12:00',
    jantar: '19:00',
    dormir: '22:00',
  },
  reminderMinutesBefore: 10,
};
