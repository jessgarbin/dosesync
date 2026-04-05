import { useEffect, useState } from 'react';
import type { Settings as SettingsType, AIProvider, CalendarProvider } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';
import {
  getMicrosoftAuthToken,
  revokeMicrosoftAuthToken,
  isMicrosoftConnected,
} from '../lib/calendar/microsoft/auth';

const AI_PROVIDERS: {
  value: AIProvider;
  label: string;
  placeholder: string;
  /** Whether this provider needs an extra model slug input. */
  needsModel: boolean;
}[] = [
  { value: 'gemini', label: 'Gemini Flash', placeholder: 'AIza...', needsModel: false },
  { value: 'claude', label: 'Claude', placeholder: 'sk-ant-...', needsModel: false },
  { value: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-v1-...', needsModel: true },
];

const CALENDAR_PROVIDERS: { value: CalendarProvider; label: string }[] = [
  { value: 'google', label: 'Google' },
  { value: 'microsoft', label: 'Microsoft' },
];

interface SettingsProps {
  onBack: () => void;
}

// Google Calendar allows reminders up to 4 weeks (40320 minutes) before the event.
const REMINDER_MAX_MINUTES = 40320;

function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h! * 60 + m!;
}

export default function Settings({ onBack }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google calendar connection state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Microsoft calendar connection state
  const [msConnected, setMsConnected] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [msError, setMsError] = useState<string | null>(null);

  async function fetchGoogleEmail(token: string) {
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGoogleEmail(data.id ?? null);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    chrome.identity?.getAuthToken({ interactive: false }).then((result) => {
      const token = result?.token;
      setGoogleConnected(!!token);
      if (token) fetchGoogleEmail(token);
    }).catch(() => {
      setGoogleConnected(false);
    });

    isMicrosoftConnected().then(setMsConnected).catch(() => setMsConnected(false));
  }, []);

  async function handleGoogleConnect() {
    setGoogleLoading(true);
    try {
      const result = await chrome.identity.getAuthToken({ interactive: true });
      const token = result?.token;
      setGoogleConnected(!!token);
      if (token) fetchGoogleEmail(token);
    } catch {
      setGoogleConnected(false);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleGoogleDisconnect() {
    setGoogleLoading(true);
    try {
      const result = await chrome.identity.getAuthToken({ interactive: false });
      const token = result?.token;
      if (token) {
        await chrome.identity.removeCachedAuthToken({ token });
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `token=${token}`,
        });
      }
    } catch { /* revocation is best-effort */ }
    setGoogleConnected(false);
    setGoogleEmail(null);
    setGoogleLoading(false);
  }

  async function handleMsConnect() {
    setMsError(null);
    const clientId = settings.microsoftClientId.trim();
    if (!clientId) {
      setMsError('Paste the Azure AD application (client) ID first, then save, then connect.');
      return;
    }
    setMsLoading(true);
    try {
      await getMicrosoftAuthToken();
      setMsConnected(true);
    } catch (e) {
      setMsError(e instanceof Error ? e.message : String(e));
      setMsConnected(false);
    } finally {
      setMsLoading(false);
    }
  }

  async function handleMsDisconnect() {
    setMsLoading(true);
    try {
      await revokeMicrosoftAuthToken();
    } catch { /* ignore */ }
    setMsConnected(false);
    setMsLoading(false);
  }

  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      if (result.settings) {
        // Merge with defaults to pick up new fields added in later versions.
        const old = result.settings as Record<string, unknown>;
        const migrated = { ...DEFAULT_SETTINGS, ...old };
        // Legacy key migration (geminiApiKey/claudeApiKey → apiKey)
        if (!old.apiKey && (old.geminiApiKey || old.claudeApiKey)) {
          migrated.apiKey = old.aiProvider === 'claude'
            ? (old.claudeApiKey as string)
            : (old.geminiApiKey as string);
        }
        setSettings(migrated as SettingsType);
      }
    });
  }, []);

  function update<K extends keyof SettingsType>(key: K, value: SettingsType[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateMealTime(key: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      mealTimes: { ...prev.mealTimes, [key]: value },
    }));
  }

  function handleSave() {
    setError(null);

    const reminder = Number(settings.reminderMinutesBefore);
    if (!Number.isFinite(reminder) || reminder < 0 || reminder > REMINDER_MAX_MINUTES) {
      setError(`Reminder must be between 0 and ${REMINDER_MAX_MINUTES} minutes (4 weeks).`);
      return;
    }

    const cafe = hhmmToMinutes(settings.mealTimes.cafe);
    const almoco = hhmmToMinutes(settings.mealTimes.almoco);
    const jantar = hhmmToMinutes(settings.mealTimes.jantar);
    const dormir = hhmmToMinutes(settings.mealTimes.dormir);
    if ([cafe, almoco, jantar, dormir].some((n) => !Number.isFinite(n))) {
      setError('All meal times must be valid.');
      return;
    }
    if (!(cafe < almoco && almoco < jantar && jantar < dormir)) {
      setError('Meal times must be in order: Breakfast < Lunch < Dinner < Bedtime.');
      return;
    }

    // OpenRouter requires a model slug. Other providers use their own defaults.
    if (settings.aiProvider === 'openrouter' && !settings.openrouterModel.trim()) {
      setError('Set an OpenRouter model slug (e.g., "google/gemini-2.0-flash-exp:free").');
      return;
    }

    const normalized: SettingsType = {
      ...settings,
      apiKey: settings.apiKey.trim(),
      openrouterModel: settings.openrouterModel.trim(),
      microsoftClientId: settings.microsoftClientId.trim(),
      reminderMinutesBefore: Math.floor(reminder),
    };

    chrome.storage.local.set({ settings: normalized }, () => {
      setSettings(normalized);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const currentProvider = AI_PROVIDERS.find(p => p.value === settings.aiProvider)!;

  return (
    <div className="rx-app">
      <div className="rx-header">
        <button className="rx-back-btn" onClick={onBack} title="Back">{'\u2190'}</button>
        <h2>Settings</h2>
        <div />
      </div>

      <div className="rx-body rx-settings-form">
        {/* Calendar provider */}
        <section className="rx-settings-section">
          <h3 className="rx-settings-section-title">Calendar</h3>
          <div className="rx-provider-selector">
            {CALENDAR_PROVIDERS.map(provider => (
              <button
                key={provider.value}
                className={`rx-provider-option${settings.calendarProvider === provider.value ? ' active' : ''}`}
                onClick={() => update('calendarProvider', provider.value)}
              >
                {provider.label}
              </button>
            ))}
          </div>

          {settings.calendarProvider === 'google' ? (
            <div className="rx-calendar-status-row" style={{ marginTop: '8px' }}>
              <span className={`rx-calendar-dot${googleConnected ? ' connected' : ''}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {googleConnected
                  ? <span className="rx-calendar-email">{googleEmail ?? 'Connected'}</span>
                  : <span>Not connected</span>
                }
              </div>
              <button
                className={`rx-btn rx-btn-sm ${googleConnected ? 'rx-btn-outline' : 'rx-btn-primary'}`}
                onClick={googleConnected ? handleGoogleDisconnect : handleGoogleConnect}
                disabled={googleLoading}
              >
                {googleLoading ? '...' : googleConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          ) : (
            <>
              <div className="rx-field" style={{ marginTop: '8px' }}>
                <label>Azure AD client (application) ID</label>
                <input
                  type="text"
                  value={settings.microsoftClientId}
                  onChange={(e) => update('microsoftClientId', e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>
              <div className="rx-calendar-status-row" style={{ marginTop: '8px' }}>
                <span className={`rx-calendar-dot${msConnected ? ' connected' : ''}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {msConnected ? <span>Connected</span> : <span>Not connected</span>}
                </div>
                <button
                  className={`rx-btn rx-btn-sm ${msConnected ? 'rx-btn-outline' : 'rx-btn-primary'}`}
                  onClick={msConnected ? handleMsDisconnect : handleMsConnect}
                  disabled={msLoading}
                >
                  {msLoading ? '...' : msConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
              {msError && <div className="rx-error" style={{ marginTop: '6px' }}>{msError}</div>}
            </>
          )}
        </section>

        {/* AI Model */}
        <section className="rx-settings-section">
          <h3 className="rx-settings-section-title">AI Model (photo/PDF only)</h3>
          <div className="rx-provider-selector">
            {AI_PROVIDERS.map(provider => (
              <button
                key={provider.value}
                className={`rx-provider-option${settings.aiProvider === provider.value ? ' active' : ''}`}
                onClick={() => update('aiProvider', provider.value)}
              >
                {provider.label}
              </button>
            ))}
          </div>
          <div className="rx-field" style={{ marginTop: '8px' }}>
            <label>API Key ({currentProvider.label})</label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
              placeholder={currentProvider.placeholder}
            />
          </div>
          {currentProvider.needsModel && (
            <div className="rx-field" style={{ marginTop: '8px' }}>
              <label>Model slug</label>
              <input
                type="text"
                value={settings.openrouterModel}
                onChange={(e) => update('openrouterModel', e.target.value)}
                placeholder="google/gemini-2.0-flash-exp:free"
              />
              <small style={{ color: '#80868b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                Use a vision-capable model for photo/PDF uploads.
              </small>
            </div>
          )}
        </section>

        {/* Routine */}
        <section className="rx-settings-section">
          <h3 className="rx-settings-section-title">Routine</h3>
          <div className="rx-card-grid">
            {([
              ['cafe', 'Breakfast'],
              ['almoco', 'Lunch'],
              ['jantar', 'Dinner'],
              ['dormir', 'Bedtime'],
            ] as const).map(([key, label]) => (
              <div key={key} className="rx-field">
                <label>{label}</label>
                <input type="time" value={settings.mealTimes[key]}
                  onChange={(e) => updateMealTime(key, e.target.value)} />
              </div>
            ))}
          </div>
        </section>

        {/* Reminders */}
        <section className="rx-settings-section">
          <h3 className="rx-settings-section-title">Reminders</h3>
          <div className="rx-field">
            <label>Minutes before (max {REMINDER_MAX_MINUTES})</label>
            <input type="number" min={0} max={REMINDER_MAX_MINUTES} value={settings.reminderMinutesBefore}
              onChange={(e) => update('reminderMinutesBefore', Number(e.target.value))}
              style={{ width: '80px' }} />
          </div>
        </section>

        {error && <div className="rx-error">{error}</div>}
      </div>

      <div className="rx-footer">
        <div />
        <button className="rx-btn rx-btn-primary" onClick={handleSave}>
          {saved ? '\u2713 Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}
