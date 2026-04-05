import { useState } from 'react';
import type { Medication, Frequency, FoodCondition } from '../../types/medication';
import type { ScheduledDose } from '../../types/schedule';

interface MedicationRowProps {
  medication: Medication;
  doses: { dose: ScheduledDose; originalIndex: number }[];
  color: string;
  overflowHorario: string | null;
  onChange: (updated: Medication) => void;
  onRemove: () => void;
  onTimeChange: (originalIndex: number, newTime: string) => void;
  onTimeBlur: () => void;
}

const FREQ_LABELS: Record<Frequency, string> = {
  '1x_dia': '1x/day',
  '2x_dia': '2x/day',
  '3x_dia': '3x/day',
  '4x_dia': '4x/day',
  'cada_4h': 'Every 4h',
  'cada_6h': 'Every 6h',
  'cada_8h': 'Every 8h',
  'cada_12h': 'Every 12h',
};

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: '1x_dia', label: '1x/day' },
  { value: '2x_dia', label: '2x/day' },
  { value: '3x_dia', label: '3x/day' },
  { value: '4x_dia', label: '4x/day' },
  { value: 'cada_4h', label: 'Every 4h' },
  { value: 'cada_6h', label: 'Every 6h' },
  { value: 'cada_8h', label: 'Every 8h' },
  { value: 'cada_12h', label: 'Every 12h' },
];

const COND_OPTIONS: { value: FoodCondition; label: string }[] = [
  { value: 'jejum', label: 'Fasting' },
  { value: 'antes_refeicao', label: 'Before meal' },
  { value: 'com_refeicao', label: 'With meal' },
  { value: 'apos_refeicao', label: 'After meal' },
  { value: 'antes_dormir', label: 'Before bed' },
  { value: 'qualquer', label: 'Any time' },
];

const COND_SHORT: Record<FoodCondition, string> = {
  jejum: 'Fasting',
  antes_refeicao: 'Before meal',
  com_refeicao: 'With meal',
  apos_refeicao: 'After meal',
  antes_dormir: 'Before bed',
  qualquer: '',
};

export default function MedicationRow({
  medication, doses, color, overflowHorario, onChange, onRemove, onTimeChange, onTimeBlur,
}: MedicationRowProps) {
  const [editing, setEditing] = useState(!medication.nome);

  const update = <K extends keyof Medication>(field: K, value: Medication[K]) => {
    onChange({ ...medication, [field]: value });
  };

  const isValid = medication.nome.trim() !== '';

  const durLabel = medication.duracao_dias ? `${medication.duracao_dias}d` : 'Ongoing';
  const condShort = COND_SHORT[medication.condicao];
  const summaryParts = [
    medication.posologia,
    FREQ_LABELS[medication.frequencia],
    durLabel,
    condShort,
  ].filter(Boolean);

  return (
    <div className="rx-med-row" style={{ borderLeftColor: color }}>
      {editing ? (
        <>
          <div className="rx-med-row-header">
            <input
              className={`rx-med-row-name-input${!medication.nome.trim() ? ' rx-field-error' : ''}`}
              value={medication.nome}
              onChange={(e) => update('nome', e.target.value)}
              placeholder="Medication name"
              autoFocus
            />
            <button className="rx-btn-icon" onClick={onRemove} title="Remove">{'\u2715'}</button>
          </div>
          <div className="rx-card-grid" style={{ marginTop: '8px' }}>
            <div className="rx-field">
              <label>Dosage</label>
              <input value={medication.dosagem} onChange={(e) => update('dosagem', e.target.value)} placeholder="e.g. 500mg (optional)" />
            </div>
            <div className="rx-field">
              <label>Instructions</label>
              <input value={medication.posologia} onChange={(e) => update('posologia', e.target.value)} placeholder="e.g. 1 tablet" />
            </div>
            <div className="rx-field">
              <label>Frequency</label>
              <select value={medication.frequencia} onChange={(e) => update('frequencia', e.target.value as Frequency)}>
                {FREQ_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="rx-field">
              <label>Duration (days)</label>
              <input
                type="number"
                min={1}
                value={medication.duracao_dias ?? ''}
                onChange={(e) => update('duracao_dias', e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="Ongoing"
              />
            </div>
            <div className="rx-field">
              <label>Meal condition</label>
              <select value={medication.condicao} onChange={(e) => update('condicao', e.target.value as FoodCondition)}>
                {COND_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="rx-field">
              <label>Notes</label>
              <input value={medication.observacoes ?? ''} onChange={(e) => update('observacoes', e.target.value || null)} placeholder="Optional" />
            </div>
          </div>
        </>
      ) : (
        <div className="rx-med-row-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rx-med-row-name">
              {medication.nome} <span className="rx-med-row-dosage">{medication.dosagem}</span>
            </div>
            <div className="rx-med-row-summary">{summaryParts.join(' \u00B7 ')}</div>
          </div>
          <div className="rx-med-row-actions">
            <button className="rx-btn-icon" onClick={() => setEditing(true)} title="Edit">{'\u270E'}</button>
            <button className="rx-btn-icon" onClick={onRemove} title="Remove">{'\u2715'}</button>
          </div>
        </div>
      )}

      {/* Times — always visible */}
      <div className="rx-med-row-times">
        {doses.map(({ dose, originalIndex }) => (
          <input
            key={originalIndex}
            type="time"
            className={`rx-time-pill${overflowHorario === dose.horario ? ' rx-time-overflow' : ''}`}
            value={dose.horario}
            onChange={(e) => onTimeChange(originalIndex, e.target.value)}
            onBlur={onTimeBlur}
          />
        ))}
      </div>

      {overflowHorario && (
        <div className="rx-med-row-overflow">Dose exceeds midnight. Adjust the time.</div>
      )}

      {editing && (
        <button className="rx-btn rx-btn-primary rx-med-row-save" onClick={() => setEditing(false)} disabled={!isValid}>
          Save
        </button>
      )}
    </div>
  );
}
