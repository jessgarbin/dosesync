import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Medication } from '../../types/medication';
import type { ScheduledDose, CalendarEvent, MealTimes } from '../../types/schedule';
import type { Settings } from '../../types/settings';
import { DEFAULT_SETTINGS } from '../../types/settings';
import {
  formatDate,
  getIntervalHours,
  buildDosesFromMedications,
  buildCalendarEventsFromDoses,
} from '../../lib/schedule-utils';
import MedicationRow from './MedicationRow';

const MED_COLORS = [
  '#1a73e8', '#ea4335', '#34a853', '#fbbc04',
  '#a142f4', '#ff6d01', '#46bdc6', '#e8710a',
];

interface StepReviewProps {
  medications: Medication[];
  onMedicationsChange: (meds: Medication[]) => void;
  onEventsChange: (events: CalendarEvent[]) => void;
  onValidChange: (valid: boolean) => void;
  loading: boolean;
}

function generateId(): string {
  return `med_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function StepReview({
  medications, onMedicationsChange, onEventsChange, onValidChange, loading,
}: StepReviewProps) {
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [mealTimes, setMealTimes] = useState<MealTimes>(DEFAULT_SETTINGS.mealTimes);
  const [reminderMinutes, setReminderMinutes] = useState(DEFAULT_SETTINGS.reminderMinutesBefore);
  const [doses, setDoses] = useState<ScheduledDose[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [overflowInfo, setOverflowInfo] = useState<{ medId: string; horario: string } | null>(null);

  // Load settings
  useEffect(() => {
    chrome.storage?.local.get('settings', (result: Record<string, unknown>) => {
      const settings = result['settings'] as Settings | undefined;
      if (settings?.mealTimes) {
        setMealTimes(settings.mealTimes);
      }
      if (settings?.reminderMinutesBefore != null) {
        setReminderMinutes(settings.reminderMinutesBefore);
      }
    });
  }, []);

  // Generate doses when medications or mealTimes change
  useEffect(() => {
    const allDoses = buildDosesFromMedications(medications, mealTimes);
    setDoses(allDoses);
  }, [medications, mealTimes]);

  // Generate calendar events when doses or startDate change
  useEffect(() => {
    if (doses.length === 0) {
      setEvents([]);
      onEventsChange([]);
      return;
    }
    const newEvents = buildCalendarEventsFromDoses(doses, medications, startDate, reminderMinutes);
    setEvents(newEvents);
    onEventsChange(newEvents);
  }, [doses, startDate, medications, reminderMinutes, onEventsChange]);

  const handleMedChange = useCallback((index: number, updated: Medication) => {
    const newMeds = [...medications];
    newMeds[index] = updated;
    onMedicationsChange(newMeds);
  }, [medications, onMedicationsChange]);

  const handleMedRemove = useCallback((index: number) => {
    onMedicationsChange(medications.filter((_, i) => i !== index));
  }, [medications, onMedicationsChange]);

  const handleAddMed = useCallback(() => {
    onMedicationsChange([...medications, {
      id: generateId(),
      nome: '',
      dosagem: '',
      posologia: '1 tablet',
      frequencia: '1x_dia',
      duracao_dias: 7,
      condicao: 'qualquer',
      observacoes: null,
    }]);
  }, [medications, onMedicationsChange]);

  // Track which dose is being edited to calculate delta on blur
  const editingRef = useRef<{ index: number; oldTime: string } | null>(null);

  const handleTimeChange = useCallback((index: number, newTime: string) => {
    setDoses(prev => {
      const dose = prev[index];
      if (!dose) return prev;
      // Save the original time before the first edit
      if (!editingRef.current) {
        editingRef.current = { index, oldTime: dose.horario };
      }
      const updated = [...prev];
      updated[index] = { ...dose, horario: newTime };
      return updated;
    });
  }, []);

  const handleTimeBlur = useCallback(() => {
    const editInfo = editingRef.current;
    editingRef.current = null;

    setDoses(prev => {
      if (!editInfo) return prev.sort((a, b) => a.horario.localeCompare(b.horario));

      const updated = [...prev];
      const editedDose = updated[editInfo.index];
      if (!editedDose || editedDose.horario === editInfo.oldTime) {
        return updated.sort((a, b) => a.horario.localeCompare(b.horario));
      }

      const med = medications.find(m => m.id === editedDose.medicationId);
      const intervalH = getIntervalHours(med?.frequencia);

      const medDoses = updated
        .map((d, idx) => ({ dose: d, idx }))
        .filter(d => d.dose.medicationId === editedDose.medicationId)
        .sort((a, b) => a.dose.horario.localeCompare(b.dose.horario));

      if (medDoses.length < 2) {
        setOverflowInfo(null);
        return updated.sort((a, b) => a.horario.localeCompare(b.horario));
      }

      let hasOverflow = false;

      if (intervalH) {
        const [firstH, firstM] = medDoses[0]!.dose.horario.split(':').map(Number) as [number, number];
        let baseMins = firstH * 60 + firstM;

        for (let j = 1; j < medDoses.length; j++) {
          baseMins += intervalH * 60;
          if (baseMins >= 24 * 60) {
            hasOverflow = true;
            break;
          }
          const h = Math.floor(baseMins / 60).toString().padStart(2, '0');
          const m = (baseMins % 60).toString().padStart(2, '0');
          updated[medDoses[j]!.idx] = { ...updated[medDoses[j]!.idx]!, horario: `${h}:${m}` };
        }
      } else {
        const [oldH, oldM] = editInfo.oldTime.split(':').map(Number) as [number, number];
        const [newH, newM] = editedDose.horario.split(':').map(Number) as [number, number];
        const deltaMin = (newH * 60 + newM) - (oldH * 60 + oldM);

        if (deltaMin !== 0) {
          const editedPos = medDoses.findIndex(d => d.idx === editInfo.index);

          for (let j = editedPos + 1; j < medDoses.length; j++) {
            const [dh, dm] = medDoses[j]!.dose.horario.split(':').map(Number) as [number, number];
            const newMins = dh * 60 + dm + deltaMin;
            if (newMins < 0 || newMins >= 24 * 60) {
              hasOverflow = true;
              break;
            }
            const h = Math.floor(newMins / 60).toString().padStart(2, '0');
            const m = (newMins % 60).toString().padStart(2, '0');
            updated[medDoses[j]!.idx] = { ...updated[medDoses[j]!.idx]!, horario: `${h}:${m}` };
          }
        }
      }

      setOverflowInfo(hasOverflow
        ? { medId: editedDose.medicationId, horario: editedDose.horario }
        : null,
      );
      return updated.sort((a, b) => a.horario.localeCompare(b.horario));
    });
  }, [medications]);

  // Validation: report whether everything is valid for creating events
  useEffect(() => {
    const allMedsValid = medications.length > 0 && medications.every(
      m => m.nome.trim() !== '',
    );
    onValidChange(allMedsValid && !overflowInfo);
  }, [medications, overflowInfo, onValidChange]);

  // Color map
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    medications.forEach((med, i) => {
      map.set(med.id, MED_COLORS[i % MED_COLORS.length]!);
    });
    return map;
  }, [medications]);

  // Total doses
  const totalDoses = events.reduce((sum, ev) => {
    const countMatch = ev.recurrence[0]?.match(/COUNT=(\d+)/);
    return sum + (countMatch ? parseInt(countMatch[1]!, 10) : 1);
  }, 0);

  if (loading) {
    return (
      <div className="rx-loading">
        <div className="rx-spinner" />
        <div className="rx-loading-text">Creating events on Google Calendar...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="rx-date-field">
        <label>Start:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>

      {medications.length === 0 && (
        <div style={{ textAlign: 'center', padding: '16px', color: '#5f6368', fontSize: '13px' }}>
          No medications. Add one below.
        </div>
      )}

      {medications.map((med, i) => {
        const medDoses = doses
          .map((dose, idx) => ({ dose, originalIndex: idx }))
          .filter(d => d.dose.medicationId === med.id);

        return (
          <MedicationRow
            key={med.id}
            medication={med}
            doses={medDoses}
            color={colorMap.get(med.id) ?? '#1a73e8'}
            overflowHorario={overflowInfo?.medId === med.id ? overflowInfo.horario : null}
            onChange={(updated) => handleMedChange(i, updated)}
            onRemove={() => handleMedRemove(i)}
            onTimeChange={handleTimeChange}
            onTimeBlur={handleTimeBlur}
          />
        );
      })}

      <button className="rx-add-med" onClick={handleAddMed}>
        + Add medication
      </button>

      {events.length > 0 && (
        <div className="rx-review-summary">
          <span className="rx-review-count">{totalDoses}</span>
          <span className="rx-review-label">
            {' '}dose{totalDoses !== 1 ? 's' : ''} in {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
