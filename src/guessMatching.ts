// Shared by every type-the-answer quiz (countries, capitals, NBA teams,
// whatever's next): normalizes input text and builds a name+alias lookup so
// matching a guess is a single map lookup rather than a scan. Previously
// lived inside countryAliases.ts with COUNTRY_ALIASES baked in — pulled out
// once a second quiz (NBA teams) needed the exact same matching logic
// against a different alias list, rather than copy-pasting it.
export function normalizeGuess(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function buildGuessLookup(guessableNames: string[], aliases: Record<string, string> = {}): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const name of guessableNames) lookup.set(normalizeGuess(name), name)
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (guessableNames.includes(canonical)) lookup.set(normalizeGuess(alias), canonical)
  }
  return lookup
}

export function matchGuess(lookup: Map<string, string>, input: string): string | undefined {
  const normalized = normalizeGuess(input)
  if (!normalized) return undefined
  return lookup.get(normalized)
}
