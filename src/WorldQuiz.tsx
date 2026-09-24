import { useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid } from 'd3'
import { Link } from 'react-router-dom'
import { Color } from 'three'
import { buildGuessLookup, matchGuess } from './countryAliases'
import { CONTINENT_BY_COUNTRY, CONTINENT_ORDER, TERRITORY_PARENT, type Continent } from './continents'
import GlobeStatus from './GlobeStatus'
import Sidebar from './Sidebar'
import { altitudeForCountry, LAND_COLOR, useWorldGlobe } from './useWorldGlobe'

const GUESSED_COLOR = new Color('#4ade80')
const MISSED_COLOR = new Color('#ef4444')
const MISSING_POINT_COLOR = '#fbbf24'
const GAME_DURATION_SECONDS = 15 * 60

// TERRITORY_PARENT's values are short display labels ('US', 'UK'), not
// necessarily the exact guessable NAME string — everything except those two
// already matches (e.g. 'France', 'Netherlands' are spelled the same both
// places), so only the mismatches need mapping.
const PARENT_LABEL_TO_COUNTRY: Record<string, string> = {
  US: 'United States of America',
  UK: 'United Kingdom',
}

// The inverse of TERRITORY_PARENT: guessing a sovereign country marks its
// territories (Puerto Rico, Guam, etc.) as complete alongside it — they're
// not separately guessable, they just ride along with their parent.
const TERRITORIES_BY_COUNTRY: Record<string, string[]> = {}
for (const [territory, label] of Object.entries(TERRITORY_PARENT)) {
  const parent = PARENT_LABEL_TO_COUNTRY[label] ?? label
  const list = TERRITORIES_BY_COUNTRY[parent] ?? []
  list.push(territory)
  TERRITORIES_BY_COUNTRY[parent] = list
}
for (const list of Object.values(TERRITORIES_BY_COUNTRY)) list.sort((a, b) => a.localeCompare(b))

// Matches each continent to its own color, both for the guessed-country
// panels and the remaining-count badges, so they're distinguishable at a
// glance rather than all reading as one undifferentiated green list.
const CONTINENT_COLOR: Record<Continent, string> = {
  Africa: '#c084fc',
  Asia: '#f87171',
  Europe: '#60a5fa',
  'North America': '#fb923c',
  Oceania: '#22d3ee',
  'South America': '#4ade80',
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function WorldQuiz() {
  const { containerRef, globeRef, countries, paintCountry, isLoading, loadError, retry } = useWorldGlobe({ autoRotate: false })

  // Sovereign countries only, matching the ~196 commonly cited world total —
  // dependent territories aren't separately guessable (see
  // TERRITORIES_BY_COUNTRY above: guessing the parent completes them
  // instead), and Antarctica isn't a country.
  const guessableNames = useMemo(
    () => countries.map((c) => c.properties.NAME).filter((name) => name in CONTINENT_BY_COUNTRY && !(name in TERRITORY_PARENT)),
    [countries],
  )
  const guessLookup = useMemo(() => buildGuessLookup(guessableNames), [guessableNames])
  const countryByName = useMemo(() => new Map(countries.map((c) => [c.properties.NAME, c])), [countries])
  const centroidByName = useMemo(() => {
    const map = new Map<string, [number, number]>()
    for (const country of countries) map.set(country.properties.NAME, geoCentroid(country))
    return map
  }, [countries])

  const [hasStarted, setHasStarted] = useState(false)
  const [guessed, setGuessed] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(GAME_DURATION_SECONDS)
  const [isPaused, setIsPaused] = useState(false)
  const [hasGivenUp, setHasGivenUp] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  // Accordion: only one continent's list open at a time during play, so
  // the sidebar never has to hold more than one continent's worth of
  // country rows at once. At game over every continent opens regardless —
  // see isOpen below — since the whole point of finishing is seeing the
  // full reveal without clicking through each one.
  const [expandedContinent, setExpandedContinent] = useState<Continent | null>(null)
  const isGameOver = hasGivenUp || secondsLeft <= 0
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!hasStarted || isPaused || isGameOver) return
    const timeout = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(timeout)
  }, [hasStarted, secondsLeft, isPaused, isGameOver])

  // The input only mounts once the quiz starts, so focusing it from the
  // Start Quiz button's own click handler would fire before that render
  // even happens — the ref is still null at that point. An effect keyed on
  // hasStarted runs after the input has actually mounted.
  useEffect(() => {
    if (hasStarted) inputRef.current?.focus()
  }, [hasStarted])

  // A location hint, not an answer reveal: small dots at each unguessed
  // country's centroid (matching how these quizzes conventionally offer a
  // "where" hint without giving away the name or shape), toggleable at any
  // time without pausing or ending the game.
  //
  // This array is built once and never rebuilt while toggled on — only the
  // per-point radius/color accessors change as you guess. Rebuilding the
  // array itself (even with the guessed entry filtered out) makes
  // three-globe's data-join see "all new data" each time and replay the
  // enter animation for every remaining point, not just remove the one you
  // got — reads as the whole hint layer flickering/refreshing on every
  // correct guess instead of one dot quietly disappearing.
  const missingPoints = useMemo(() => {
    return guessableNames
      .map((name) => {
        const centroid = centroidByName.get(name)
        return centroid ? { name, lat: centroid[1], lng: centroid[0] } : null
      })
      .filter((point): point is { name: string; lat: number; lng: number } => point !== null)
  }, [guessableNames, centroidByName])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    if (!showMissing) {
      globe.pointsData([])
      return
    }
    globe.pointsData(missingPoints).pointLat('lat').pointLng('lng').pointAltitude(0.01)
  }, [showMissing, missingPoints, globeRef])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !showMissing) return
    const isGuessedPoint = (d: object) => guessed.has((d as { name: string }).name)
    // During play, a guessed country's dot disappears (radius 0) — there's
    // nothing left to hint at. At game over every dot comes back so its
    // name can still be hovered, but the dot itself stays the same hint
    // color throughout — only the hover text below is colored green/red to
    // match the reveal.
    globe
      .pointColor((d) => (!isGameOver && isGuessedPoint(d) ? 'rgba(0,0,0,0)' : MISSING_POINT_COLOR))
      .pointRadius((d) => (isGameOver || !isGuessedPoint(d) ? 0.3 : 0))
      // globe.gl defaults a point's hover tooltip to its `name` field, which
      // for these hint dots is the answer — hovering one during play would
      // give away the exact country a location-only hint is supposed to
      // withhold. Only reveal it once the game's already over, and the
      // tooltip is treated as HTML by the underlying renderer, so a plain
      // colored span works.
      .pointLabel((d) => {
        if (!isGameOver) return ''
        const name = (d as { name: string }).name
        const color = isGuessedPoint(d) ? '#4ade80' : '#ef4444'
        return `<span style="color: ${color}">${name}</span>`
      })
  }, [guessed, showMissing, isGameOver, globeRef])

  useEffect(() => {
    if (!isGameOver) return
    for (const name of guessableNames) {
      if (guessed.has(name)) continue
      paintCountry(name, MISSED_COLOR)
      for (const territory of TERRITORIES_BY_COUNTRY[name] ?? []) paintCountry(territory, MISSED_COLOR)
    }
  }, [isGameOver, guessableNames, guessed, paintCountry])

  const handleInputChange = (value: string) => {
    setInput(value)
    const match = matchGuess(guessLookup, value)
    if (!match || guessed.has(match)) return

    setGuessed((prev) => new Set(prev).add(match))
    paintCountry(match, GUESSED_COLOR)
    // Territories are their own landmass on the map (Puerto Rico isn't
    // part of the US's polygon), so guessing the parent has to explicitly
    // paint each one too, or they'd sit there in the default land color
    // forever, looking unrelated to the country that owns them.
    for (const territory of TERRITORIES_BY_COUNTRY[match] ?? []) paintCountry(territory, GUESSED_COLOR)
    // Jump the accordion to whichever continent that guess just landed in,
    // so the country you just got is immediately visible instead of
    // requiring a manual click over to its tab.
    setExpandedContinent(CONTINENT_BY_COUNTRY[match])
    const globe = globeRef.current
    const country = countryByName.get(match)
    if (globe && country) {
      const [lng, lat] = geoCentroid(country)
      globe.pointOfView({ lat, lng, altitude: altitudeForCountry(country) }, 1200)
    }
    setInput('')
  }

  const restart = () => {
    for (const name of guessableNames) {
      paintCountry(name, LAND_COLOR)
      for (const territory of TERRITORIES_BY_COUNTRY[name] ?? []) paintCountry(territory, LAND_COLOR)
    }
    setGuessed(new Set())
    setInput('')
    setSecondsLeft(GAME_DURATION_SECONDS)
    setIsPaused(false)
    setHasGivenUp(false)
    setShowMissing(false)
    setExpandedContinent(null)
    inputRef.current?.focus()
  }

  // During play, only the countries you've actually gotten show up (so the
  // list reads as a running tally). At game over, every country appears,
  // sorted alphabetically — guessed ones stay green, the rest turn red —
  // matching how these quizzes conventionally reveal the full answer key.
  // Each entry carries its territories along with it: they only appear once
  // their parent does, already colored the same as the parent, so a
  // territory "fills in" at the exact moment its country is guessed rather
  // than sitting there blank beforehand.
  const displayByContinent = useMemo(() => {
    const groups = new Map<Continent, { name: string; isGuessed: boolean; territories: string[] }[]>()
    for (const name of guessableNames) {
      const isGuessed = guessed.has(name)
      if (!isGameOver && !isGuessed) continue
      const continent = CONTINENT_BY_COUNTRY[name]
      const list = groups.get(continent) ?? []
      list.push({ name, isGuessed, territories: TERRITORIES_BY_COUNTRY[name] ?? [] })
      groups.set(continent, list)
    }
    if (isGameOver) {
      for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return groups
  }, [guessableNames, guessed, isGameOver])

  // Total and remaining counts per continent, shown regardless of whether
  // you've guessed anything there yet — unlike displayByContinent above,
  // which only lists continents you've already started.
  const continentProgress = useMemo(() => {
    const totals = new Map<Continent, { total: number; guessedCount: number }>()
    for (const name of guessableNames) {
      const continent = CONTINENT_BY_COUNTRY[name]
      const entry = totals.get(continent) ?? { total: 0, guessedCount: 0 }
      entry.total += 1
      if (guessed.has(name)) entry.guessedCount += 1
      totals.set(continent, entry)
    }
    return totals
  }, [guessableNames, guessed])

  const isInputDisabled = !hasStarted || isPaused || isGameOver

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <Sidebar>
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: secondsLeft <= 30 ? '#ef4444' : '#4ade80' }}>
              {formatTime(secondsLeft)}
            </span>
            {hasStarted ? (
              <span style={{ fontSize: 13, color: 'rgba(227, 236, 233, 0.7)' }}>
                {guessed.size} / {guessableNames.length} guessed
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setHasStarted(true)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#4ade80',
                  color: '#0a1312',
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Start Quiz ▶
              </button>
            )}
          </div>

          {hasStarted && (
            <>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(event) => handleInputChange(event.target.value)}
                disabled={isInputDisabled}
                placeholder="Enter country's name here:"
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  background: isInputDisabled ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                  color: '#e3ece9',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                {!isGameOver && (
                  <button
                    type="button"
                    onClick={() => setIsPaused((p) => !p)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#e3ece9',
                      cursor: 'pointer',
                    }}
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (isGameOver ? restart() : setHasGivenUp(true))}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#ef4444',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {isGameOver ? 'Play Again' : 'Give Up?'}
                </button>
              </div>
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              {hasStarted && (
                <button
                  type="button"
                  onClick={() => setShowMissing((s) => !s)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: showMissing ? '1px solid rgba(96, 165, 250, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
                    background: showMissing ? 'rgba(96, 165, 250, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                    color: '#e3ece9',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {showMissing ? 'Hide Missing Countries' : 'Show Missing Countries'}
                </button>
              )}
              <Link
                to="/"
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e3ece9',
                  fontSize: 13,
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                ← Back to Explore
              </Link>
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />

            {CONTINENT_ORDER.map((continent) => {
              const entries = displayByContinent.get(continent) ?? []
              const progress = continentProgress.get(continent)
              const isOpen = isGameOver || expandedContinent === continent
              return (
                <div key={continent}>
                  <button
                    type="button"
                    onClick={() => setExpandedContinent((c) => (c === continent ? null : continent))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '6px 0',
                      border: 'none',
                      background: 'none',
                      color: '#e3ece9',
                      fontSize: 13,
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: CONTINENT_COLOR[continent], flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>
                      {continent} {progress ? `${progress.guessedCount}/${progress.total}` : ''}
                    </span>
                    <span style={{ color: 'rgba(227, 236, 233, 0.5)' }}>{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen &&
                    entries.map(({ name, isGuessed, territories }) => (
                      <div key={name}>
                        <div style={{ padding: '4px 0 4px 16px', color: isGuessed ? '#4ade80' : '#ef4444' }}>{name}</div>
                        {territories.length > 0 && (
                          <div
                            style={{
                              padding: '0 0 4px 26px',
                              fontSize: 11,
                              lineHeight: 1.4,
                              color: isGuessed ? 'rgba(74, 222, 128, 0.7)' : 'rgba(239, 68, 68, 0.7)',
                            }}
                          >
                            {territories.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )
            })}
        </>
      </Sidebar>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <GlobeStatus isLoading={isLoading} loadError={loadError} retry={retry} />
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

export default WorldQuiz
