import { buildGuessLookup as buildLookup, matchGuess } from './guessMatching'

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

export function buildGuessLookup(guessableNames: string[]): Map<string, string> {
  return buildLookup(guessableNames, COUNTRY_ALIASES)
}

export { matchGuess }
