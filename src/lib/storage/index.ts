import type { Settings } from '../../types/settings';
import { DEFAULT_SETTINGS } from '../../types/settings';

/**
 * Reads stored settings and merges them with DEFAULT_SETTINGS so older
 * installs don't crash after a version bump that introduces new fields
 * (e.g. openrouterModel, calendarProvider, microsoftClientId).
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  const stored = result['settings'] as Partial<Settings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...(stored ?? {}),
    mealTimes: {
      ...DEFAULT_SETTINGS.mealTimes,
      ...(stored?.mealTimes ?? {}),
    },
  };
}

export async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const merged: Settings = { ...current, ...partial };
  await chrome.storage.local.set({ settings: merged });
  return merged;
}
