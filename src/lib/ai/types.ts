import type { PrescriptionInput, ParsedPrescription } from '../../types/prescription';
import type { Settings } from '../../types/settings';

/**
 * Common interface every AI provider must implement. Accepts the whole
 * settings object so providers can pick up their own config (model name,
 * API key, etc.) without the caller knowing which fields matter.
 */
export interface AIProviderModule {
  parsePrescription: (
    input: PrescriptionInput,
    settings: Settings,
  ) => Promise<ParsedPrescription>;
}
