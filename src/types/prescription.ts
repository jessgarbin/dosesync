import type { Medication } from './medication';

export type InputType = 'image' | 'pdf' | 'text';

export interface PrescriptionInput {
  type: InputType;
  /** base64 data for image/pdf, plain text for text */
  data: string;
  fileName?: string;
  /** Original MIME type of the file (e.g. image/png) */
  mimeType?: string;
}

export interface ParsedPrescription {
  medicamentos: Medication[];
  raw_text?: string;
}
