import type { AIProvider } from '../../types/settings';
import type { PrescriptionInput, ParsedPrescription } from '../../types/prescription';
import * as gemini from './gemini';
import * as claude from './claude';

export interface AIProviderModule {
  parsePrescription: (input: PrescriptionInput, apiKey: string) => Promise<ParsedPrescription>;
}

export function getAIProvider(provider: AIProvider): AIProviderModule {
  switch (provider) {
    case 'gemini':
      return gemini;
    case 'claude':
      return claude;
    default:
      throw new Error(`Unknown AI provider: ${provider as string}`);
  }
}
