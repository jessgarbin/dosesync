import type { AIProvider } from '../../types/settings';
import type { AIProviderModule } from './types';
import * as gemini from './gemini';
import * as claude from './claude';
import * as openrouter from './openrouter';

export type { AIProviderModule } from './types';

export function getAIProvider(provider: AIProvider): AIProviderModule {
  switch (provider) {
    case 'gemini':
      return gemini;
    case 'claude':
      return claude;
    case 'openrouter':
      return openrouter;
    default:
      throw new Error(`Unknown AI provider: ${provider as string}`);
  }
}
