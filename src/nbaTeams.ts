export const CONFERENCE_ORDER = ['Eastern', 'Western'] as const
export type Conference = (typeof CONFERENCE_ORDER)[number]

const EASTERN: readonly string[] = [
  'Atlanta Hawks',
  'Boston Celtics',
  'Brooklyn Nets',
  'Charlotte Hornets',
  'Chicago Bulls',
  'Cleveland Cavaliers',
  'Detroit Pistons',
  'Indiana Pacers',
  'Miami Heat',
  'Milwaukee Bucks',
  'New York Knicks',
  'Orlando Magic',
  'Philadelphia 76ers',
  'Toronto Raptors',
  'Washington Wizards',
]

const WESTERN: readonly string[] = [
  'Dallas Mavericks',
  'Denver Nuggets',
  'Golden State Warriors',
  'Houston Rockets',
  'LA Clippers',
  'Los Angeles Lakers',
  'Memphis Grizzlies',
  'Minnesota Timberwolves',
  'New Orleans Pelicans',
  'Oklahoma City Thunder',
  'Phoenix Suns',
  'Portland Trail Blazers',
  'Sacramento Kings',
  'San Antonio Spurs',
  'Utah Jazz',
]

export const CONFERENCE_BY_TEAM: Record<string, Conference> = {}
for (const team of EASTERN) CONFERENCE_BY_TEAM[team] = 'Eastern'
for (const team of WESTERN) CONFERENCE_BY_TEAM[team] = 'Western'

export const ALL_TEAMS: readonly string[] = [...EASTERN, ...WESTERN]

// Nicknames alone ("Celtics", "Lakers") are how people actually say these,
// far more often than the full city + nickname — without these, only the
// exact canonical string would be accepted, which is a worse quiz than
// typing a capital's short name already gets (see CapitalsQuiz's
// "Washington" handling). One per team, plus a couple of well-known
// shorthands (city-only, common abbreviations).
export const NBA_TEAM_ALIASES: Record<string, string> = {
  hawks: 'Atlanta Hawks',
  celtics: 'Boston Celtics',
  nets: 'Brooklyn Nets',
  hornets: 'Charlotte Hornets',
  bulls: 'Chicago Bulls',
  cavaliers: 'Cleveland Cavaliers',
  cavs: 'Cleveland Cavaliers',
  pistons: 'Detroit Pistons',
  pacers: 'Indiana Pacers',
  heat: 'Miami Heat',
  bucks: 'Milwaukee Bucks',
  knicks: 'New York Knicks',
  magic: 'Orlando Magic',
  '76ers': 'Philadelphia 76ers',
  sixers: 'Philadelphia 76ers',
  philly: 'Philadelphia 76ers',
  raptors: 'Toronto Raptors',
  wizards: 'Washington Wizards',
  mavericks: 'Dallas Mavericks',
  mavs: 'Dallas Mavericks',
  nuggets: 'Denver Nuggets',
  warriors: 'Golden State Warriors',
  'golden state': 'Golden State Warriors',
  rockets: 'Houston Rockets',
  clippers: 'LA Clippers',
  'los angeles clippers': 'LA Clippers',
  lakers: 'Los Angeles Lakers',
  grizzlies: 'Memphis Grizzlies',
  timberwolves: 'Minnesota Timberwolves',
  wolves: 'Minnesota Timberwolves',
  pelicans: 'New Orleans Pelicans',
  thunder: 'Oklahoma City Thunder',
  okc: 'Oklahoma City Thunder',
  suns: 'Phoenix Suns',
  'trail blazers': 'Portland Trail Blazers',
  trailblazers: 'Portland Trail Blazers',
  blazers: 'Portland Trail Blazers',
  kings: 'Sacramento Kings',
  spurs: 'San Antonio Spurs',
  jazz: 'Utah Jazz',
}
