import { useState, useCallback, useEffect, useRef } from 'react';
import type { Medication } from '../types/medication';
import type { CalendarEvent } from '../types/schedule';
import StepInput from './components/StepInput';
import StepReview from './components/StepReview';

type Step = 'input' | 'review';
const STEP_LABELS: Record<Step, string> = {
  input: 'Prescription',
  review: 'Schedule',
};

const STORAGE_KEY = 'wizard_state';

const STATE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface WizardState {
  step: string;
  medications: Medication[];
  calendarEvents: CalendarEvent[];
  success: boolean;
  inputText?: string;
  savedAt?: number;
}

function saveState(state: WizardState) {
  chrome.storage?.local.set({ [STORAGE_KEY]: { ...state, savedAt: Date.now() } });
}

function clearSavedState() {
  chrome.storage?.local.remove(STORAGE_KEY);
}

interface AppProps {
  onShowSettings: () => void;
}

export default function App({ onShowSettings }: AppProps) {
  const [step, setStep] = useState<Step>('input');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [inputText, setInputText] = useState('');
  const [reviewValid, setReviewValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [restored, setRestored] = useState(false);
  const skipSaveRef = useRef(true);

  // Restore state (migrate old steps to 'review', discard if expired)
  useEffect(() => {
    chrome.storage?.local.get(STORAGE_KEY, (result: Record<string, unknown>) => {
      const saved = result[STORAGE_KEY] as WizardState | undefined;
      if (saved) {
        const expired = saved.savedAt && (Date.now() - saved.savedAt > STATE_TTL_MS);
        if (expired) {
          clearSavedState();
        } else {
          if (saved.inputText) setInputText(saved.inputText);
          if (saved.step !== 'input' && !saved.success) {
            setStep('review');
            setMedications(saved.medications ?? []);
            setCalendarEvents(saved.calendarEvents ?? []);
          }
        }
      }
      setRestored(true);
      setTimeout(() => { skipSaveRef.current = false; }, 100);
    });
  }, []);

  // Save state (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (skipSaveRef.current) return;
    if (success) {
      clearSavedState();
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState({ step, medications, calendarEvents, success, inputText });
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [step, medications, calendarEvents, success, inputText]);

  const reset = useCallback(() => {
    setStep('input');
    setInputText('');
    setMedications([]);
    setCalendarEvents([]);
    setLoading(false);
    setError(null);
    setSuccess(false);
    clearSavedState();
  }, []);

  const handleParsed = useCallback((meds: Medication[]) => {
    setMedications(meds);
    setError(null);
    setStep('review');
  }, []);

  const handleEventsChange = useCallback((events: CalendarEvent[]) => {
    setCalendarEvents(events);
  }, []);

  const handleValidChange = useCallback((valid: boolean) => {
    setReviewValid(valid);
  }, []);

  const handleBack = useCallback(() => {
    setError(null);
    setStep('input');
  }, []);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'create-events',
        payload: calendarEvents,
      });

      if (!response?.success) {
        setError(response?.error || 'Failed to create events on Google Calendar.');
      } else if (response.data?.failed > 0) {
        const errors = response.data.errors?.join('\n') || '';
        if (response.data.success === 0) {
          setError(`No events were created.\n${errors}`);
        } else {
          setError(`${response.data.success} created, ${response.data.failed} failed.\n${errors}`);
          setSuccess(true);
        }
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(`Extension communication error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [calendarEvents]);

  if (!restored) {
    return (
      <div className="rx-app">
        <div className="rx-loading">
          <div className="rx-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="rx-app">
      {/* Header */}
      <div className="rx-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {step === 'review' && !success && !loading && (
            <button className="rx-back-btn" onClick={handleBack} title="Back">{'\u2190'}</button>
          )}
          <h2>{success ? 'Done!' : STEP_LABELS[step]}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {(step !== 'input' || success) && (
            <button className="rx-header-btn" onClick={reset} title="New prescription">
              {'\u002B'}
            </button>
          )}
          <button className="rx-header-btn" onClick={onShowSettings} title="Settings">
            {'\u2699'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="rx-error-wrap"><div className="rx-error">{error}</div></div>}

      {/* Body */}
      <div className="rx-body">
        {success ? (
          <div className="rx-success">
            <span className="icon">{'\u2705'}</span>
            <div className="title">Events created!</div>
            <div className="desc">{calendarEvents.length} event{calendarEvents.length !== 1 ? 's' : ''} added to Google Calendar.</div>
            <button className="rx-btn rx-btn-secondary" onClick={reset} style={{ marginTop: '16px' }}>
              New prescription
            </button>
          </div>
        ) : (
          <>
            {/* StepInput stays mounted to persist text/file */}
            <div style={{ display: step === 'input' ? 'block' : 'none' }}>
              <StepInput onParsed={handleParsed} onError={setError} onLoading={setLoading} loading={loading} text={inputText} onTextChange={setInputText} />
            </div>
            {step === 'review' && (
              <StepReview
                medications={medications}
                onMedicationsChange={setMedications}
                onEventsChange={handleEventsChange}
                onValidChange={handleValidChange}
                loading={loading}
              />
            )}
          </>
        )}
      </div>

      {/* Footer — only shows Create button */}
      {!success && !loading && step === 'review' && (
        <div className="rx-footer" style={{ justifyContent: 'flex-end' }}>
          <button
            className="rx-btn rx-btn-primary"
            onClick={handleConfirm}
            disabled={calendarEvents.length === 0 || !reviewValid}
          >
            Create {calendarEvents.length} event{calendarEvents.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}
