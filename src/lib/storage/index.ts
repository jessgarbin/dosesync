import type { Settings } from '../../types/settings';
import { DEFAULT_SETTINGS } from '../../types/settings';

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return (result['settings'] as Settings | undefined) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const merged: Settings = { ...current, ...partial };
  await chrome.storage.local.set({ settings: merged });
  return merged;
}
