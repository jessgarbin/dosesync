import { useState, useRef, useCallback } from 'react';
import type { Medication } from '../../types/medication';
import type { InputType } from '../../types/prescription';
import { parseTextPrescription } from '../../lib/parser/text-parser';
import { MAX_MEDICATIONS } from '../../lib/ai/utils';

interface StepInputProps {
  onParsed: (medications: Medication[]) => void;
  onError: (error: string | null) => void;
  onLoading: (loading: boolean) => void;
  loading: boolean;
  text: string;
  onTextChange: (text: string) => void;
}

type TabMode = 'upload' | 'text';

// Hard cap on the pasted text. ~10k characters covers any realistic
// prescription while protecting against pasting entire documents and
// running up AI API costs / timeouts.
const MAX_TEXT_LENGTH = 10_000;

function normalizeMeds(raw: Record<string, unknown>[]): Medication[] {
  return raw.map((m, i) => ({
    id: `med_${Date.now()}_${i}`,
    nome: String(m.nome ?? ''),
    dosagem: String(m.dosagem ?? ''),
    posologia: String(m.posologia ?? ''),
    frequencia: (m.frequencia as Medication['frequencia']) ?? '1x_dia',
    duracao_dias: typeof m.duracao_dias === 'number' ? m.duracao_dias : null,
    condicao: (m.condicao as Medication['condicao']) ?? 'qualquer',
    observacoes: m.observacoes ? String(m.observacoes) : null,
  }));
}

export default function StepInput({ onParsed, onError, onLoading, loading, text, onTextChange }: StepInputProps) {
  const [tab, setTab] = useState<TabMode>('text');
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      onError('Unsupported file type. Use JPEG, PNG, WebP, or PDF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      onError('File too large. Maximum 10MB.');
      return;
    }

    const type: InputType = file.type === 'application/pdf' ? 'pdf' : 'image';

    const toBase64 = (f: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] ?? result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });

    onError(null);
    onLoading(true);
    setFileName(file.name);

    try {
      const data = await toBase64(file);
      const response = await chrome.runtime.sendMessage({
        action: 'parse-prescription',
        payload: { type, data, fileName: file.name, mimeType: file.type },
      });

      if (response?.success && response.data?.medicamentos?.length > 0) {
        onParsed(normalizeMeds(response.data.medicamentos));
      } else {
        onError(response?.error || 'Could not extract medications from the file.');
      }
    } catch {
      onError('Error processing the file. Check if the API key is configured.');
    } finally {
      onLoading(false);
    }
  }, [onParsed, onError, onLoading]);

  const processText = useCallback(() => {
    if (!text.trim()) return;

    if (text.length > MAX_TEXT_LENGTH) {
      onError(`Text too long (${text.length} characters). Maximum is ${MAX_TEXT_LENGTH}.`);
      return;
    }

    onError(null);
    const meds = parseTextPrescription(text.trim());

    if (meds.length === 0) {
      onError('Could not extract medications from the text. Write one medication per line.');
      return;
    }
    if (meds.length > MAX_MEDICATIONS) {
      onError(`Too many medications detected (${meds.length}). Maximum is ${MAX_MEDICATIONS} — please split into multiple prescriptions.`);
      return;
    }
    onParsed(meds);
  }, [text, onParsed, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  if (loading) {
    return (
      <div className="rx-loading">
        <div className="rx-spinner" />
        <div className="rx-loading-text">
          Analyzing {tab === 'upload' ? `file "${fileName}"` : 'prescription text'}...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="rx-tabs">
        <button
          className={`rx-tab${tab === 'text' ? ' active' : ''}`}
          onClick={() => setTab('text')}
        >
          Paste text
        </button>
        <button
          className={`rx-tab${tab === 'upload' ? ' active' : ''}`}
          onClick={() => setTab('upload')}
        >
          Upload file
        </button>
      </div>

      {tab === 'upload' ? (
        <>
          <div
            className={`rx-upload-area rx-upload-compact${dragOver ? ' dragover' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <span className="icon">{'\uD83D\uDCF7'}</span>
            <div className="label">Drag the prescription photo or PDF here</div>
            <div className="hint">or click to select a file</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </>
      ) : (
        <>
          <textarea
            className="rx-textarea"
            placeholder={"Paste the prescription text here...\n\nExample:\nAmoxicillin 500mg - 1 capsule every 8 hours for 7 days\nIbuprofen 600mg - 1 tablet every 12 hours for 5 days"}
            value={text}
            maxLength={MAX_TEXT_LENGTH}
            onChange={(e) => onTextChange(e.target.value)}
          />
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: text.length > MAX_TEXT_LENGTH * 0.9 ? '#d93025' : '#80868b' }}>
              {text.length} / {MAX_TEXT_LENGTH}
            </span>
            <button
              className="rx-btn rx-btn-primary"
              disabled={!text.trim() || text.length > MAX_TEXT_LENGTH}
              onClick={processText}
            >
              Analyze prescription
            </button>
          </div>
        </>
      )}
    </div>
  );
}
