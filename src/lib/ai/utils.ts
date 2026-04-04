/**
 * Remove markdown code fences (```json ... ```) que modelos de IA
 * frequentemente adicionam ao redor do JSON.
 */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}
