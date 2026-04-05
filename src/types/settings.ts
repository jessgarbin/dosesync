import type { MealTimes } from './schedule';

export type AIProvider = 'gemini' | 'claude' | 'openrouter';
export type CalendarProvider = 'google' | 'microsoft';

export interface Settings {
  aiProvider: AIProvider;
  apiKey: string;
  /**
   * Model slug used when aiProvider === 'openrouter'.
   * Examples: "google/gemini-2.0-flash-exp:free", "anthropic/claude-3.5-sonnet",
   * "openai/gpt-4o". Must be a vision-capable model for photo/PDF input.
   */
  openrouterModel: string;
  calendarProvider: CalendarProvider;
  /**
   * Azure AD application (client) ID used for Microsoft Graph OAuth via PKCE.
   * Required only when calendarProvider === 'microsoft'.
   */
  microsoftClientId: string;
  mealTimes: MealTimes;
  reminderMinutesBefore: number;
}

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'gemini',
  apiKey: '',
  openrouterModel: 'google/gemini-2.0-flash-exp:free',
  calendarProvider: 'google',
  microsoftClientId: '',
  mealTimes: {
    cafe: '07:00',
    almoco: '12:00',
    jantar: '19:00',
    dormir: '22:00',
  },
  reminderMinutesBefore: 10,
};
