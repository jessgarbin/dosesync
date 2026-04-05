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
  /**
   * Cheapest possible call to validate the API key. Throws on invalid key,
   * quota exhaustion, network failure, etc. Resolves silently on success.
   * Used by the Settings UI "Test key" button so users can verify their
   * key before they waste a real parsing call on a broken configuration.
   */
  testKey: (settings: Settings) => Promise<void>;
}
