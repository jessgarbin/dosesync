import { useEffect, useState } from 'react';
import type { Settings as SettingsType, AIProvider } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

const AI_PROVIDERS: { value: AIProvider; label: string; placeholder: string }[] = [
  { value: 'gemini', label: 'Gemini Flash', placeholder: 'AIza...' },
  { value: 'claude', label: 'Claude', placeholder: 'sk-ant-...' },
];

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

  async function fetchCalendarEmail(token: string) {
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCalendarEmail(data.id ?? null);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    chrome.identity?.getAuthToken({ interactive: false }).then((result) => {
      const token = result?.token;
      setCalendarConnected(!!token);
      if (token) fetchCalendarEmail(token);
    }).catch(() => {
      setCalendarConnected(false);
    });
  }, []);

  async function handleConnect() {
    setCalendarLoading(true);
    try {
      const result = await chrome.identity.getAuthToken({ interactive: true });
      const token = result?.token;
      setCalendarConnected(!!token);
      if (token) fetchCalendarEmail(token);
    } catch {
      setCalendarConnected(false);
    } finally {
      setCalendarLoading(false);
    }
  }

  async function handleDisconnect() {
    setCalendarLoading(true);
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
    setCalendarConnected(false);
    setCalendarEmail(null);
    setCalendarLoading(false);
  }

  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      if (result.settings) {
        // Migrate old settings (geminiApiKey/claudeApiKey → apiKey)
        const old = result.settings as Record<string, unknown>;
        const migrated = { ...DEFAULT_SETTINGS, ...old };
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
    chrome.storage.local.set({ settings }, () => {
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
        {/* Google Calendar */}
        <section className="rx-settings-section">
          <h3 className="rx-settings-section-title">Google Calendar</h3>
          <div className="rx-calendar-status-row">
            <span className={`rx-calendar-dot${calendarConnected ? ' connected' : ''}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {calendarConnected
                ? <span className="rx-calendar-email">{calendarEmail ?? 'Connected'}</span>
                : <span>Not connected</span>
              }
            </div>
            <button
              className={`rx-btn rx-btn-sm ${calendarConnected ? 'rx-btn-outline' : 'rx-btn-primary'}`}
              onClick={calendarConnected ? handleDisconnect : handleConnect}
              disabled={calendarLoading}
            >
              {calendarLoading ? '...' : calendarConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </section>

        {/* AI Model */}
        <section className="rx-settings-section">
          <h3 className="rx-settings-section-title">AI Model</h3>
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
            <label>Minutes before</label>
            <input type="number" min={0} value={settings.reminderMinutesBefore}
              onChange={(e) => update('reminderMinutesBefore', Number(e.target.value))}
              style={{ width: '80px' }} />
          </div>
        </section>
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
