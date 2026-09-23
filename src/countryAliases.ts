// Common alternate names/spellings accepted alongside each country's
// canonical name in the world quiz. Not exhaustive — covers well-known
// short names, former names, and common misspellings; easy to extend.
export const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States of America',
  us: 'United States of America',
  america: 'United States of America',
  'united states': 'United States of America',
  uk: 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  drc: 'Democratic Republic of the Congo',
  'dr congo': 'Democratic Republic of the Congo',
  'congo kinshasa': 'Democratic Republic of the Congo',
  congo: 'Republic of the Congo',
  'congo brazzaville': 'Republic of the Congo',
  czechia: 'Czech Republic',
  "cote d'ivoire": 'Ivory Coast',
  'cote divoire': 'Ivory Coast',
  'timor leste': 'East Timor',
  swaziland: 'Eswatini',
  macedonia: 'North Macedonia',
  burma: 'Myanmar',
  uae: 'United Arab Emirates',
  'korea south': 'South Korea',
  'republic of korea': 'South Korea',
  'korea north': 'North Korea',
  dprk: 'North Korea',
  micronesia: 'Federated States of Micronesia',
  'holy see': 'Vatican City',
  'the vatican': 'Vatican City',
  'sao tome': 'São Tomé and Príncipe',
  'sao tome and principe': 'São Tomé and Príncipe',
  'cabo verde': 'Cape Verde',
  trinidad: 'Trinidad and Tobago',
  antigua: 'Antigua and Barbuda',
  'st kitts and nevis': 'Saint Kitts and Nevis',
  'saint kitts': 'Saint Kitts and Nevis',
  'st vincent and the grenadines': 'Saint Vincent and the Grenadines',
  'st lucia': 'Saint Lucia',
  bosnia: 'Bosnia and Herzegovina',
  car: 'Central African Republic',
  'the bahamas': 'Bahamas',
  'the gambia': 'Gambia',
  'brunei darussalam': 'Brunei',
  'lao pdr': 'Laos',
  'russian federation': 'Russia',
  'syrian arab republic': 'Syria',
  'islamic republic of iran': 'Iran',
  persia: 'Iran',
  turkiye: 'Turkey',
  holland: 'Netherlands',
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Maps every normalized guessable name and known alias to its canonical
// name, so matching user input is a single lookup rather than a scan.
// extraAliases works the same as COUNTRY_ALIASES (only wired up if its
// canonical is actually guessable) — callers use it for aliases that only
// make sense for their own guessable list, like a quiz that wants territory
// names to resolve to their parent country.
export function buildGuessLookup(guessableNames: string[], extraAliases: Record<string, string> = {}): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const name of guessableNames) lookup.set(normalize(name), name)
  for (const [alias, canonical] of [...Object.entries(COUNTRY_ALIASES), ...Object.entries(extraAliases)]) {
    if (guessableNames.includes(canonical)) lookup.set(normalize(alias), canonical)
  }
  return lookup
}

export function matchGuess(lookup: Map<string, string>, input: string): string | undefined {
  const normalized = normalize(input)
  if (!normalized) return undefined
  return lookup.get(normalized)
}
