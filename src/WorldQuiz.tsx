import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid } from 'd3'
import { Link } from 'react-router-dom'
import { Color } from 'three'
import { buildGuessLookup, matchGuess } from './countryAliases'
import { CONTINENT_BY_COUNTRY, CONTINENT_ORDER, TERRITORY_PARENT, type Continent } from './continents'
import GlobeStatus from './GlobeStatus'
import { LAND_COLOR, useWorldGlobe } from './useWorldGlobe'

const GUESSED_COLOR = new Color('#4ade80')
const MISSED_COLOR = new Color('#ef4444')
const MISSING_POINT_COLOR = '#fbbf24'
const GAME_DURATION_SECONDS = 15 * 60
const VIEW_POLL_INTERVAL_MS = 400

// "Viewing: X" covers the whole sphere, oceans included, so it needs one
// more zone than the guessable continents: Antarctica isn't a country and
// has no guessable countries of its own, but it's still real estate on the
// globe worth naming when the camera's pointed at it.
type ViewingRegion = Continent | 'Antarctica'

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
const VIEWING_COLOR: Record<ViewingRegion, string> = { ...CONTINENT_COLOR, Antarctica: '#e2e8f0' }

// Converts a lng/lat pair to a unit vector on the sphere, so "nearest zone"
// can be answered with a dot product instead of point-in-polygon testing —
// the only way to give every ocean point a zone too, not just points that
// happen to land inside a country's coastline.
function toUnitVector(lng: number, lat: number): [number, number, number] {
  const lambda = (lng * Math.PI) / 180
  const phi = (lat * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)]
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const panelStyle: CSSProperties = {
  borderRadius: 8,
  border: '1px solid rgba(255, 255, 255, 0.15)',
  background: 'rgba(10, 19, 18, 0.85)',
  fontSize: 13,
}

function WorldQuiz() {
  const { containerRef, globeRef, countries, paintCountry, isLoading, loadError, retry } = useWorldGlobe({ autoRotate: false })

  // Sovereign countries only, matching the ~196 commonly cited world total —
  // dependent territories (Puerto Rico, Bermuda, etc., see TERRITORY_PARENT)
  // aren't quizzed as their own countries, and Antarctica isn't a country.
  const guessableNames = useMemo(
    () => countries.map((c) => c.properties.NAME).filter((name) => name in CONTINENT_BY_COUNTRY && !(name in TERRITORY_PARENT)),
    [countries],
  )
  const guessLookup = useMemo(() => buildGuessLookup(guessableNames), [guessableNames])
  const centroidByName = useMemo(() => {
    const map = new Map<string, [number, number]>()
    for (const country of countries) map.set(country.properties.NAME, geoCentroid(country))
    return map
  }, [countries])

  // Everything the globe actually renders that the quiz doesn't ask about:
  // dependent territories (shown with their parent, same as the explorer's
  // dropdown) plus Antarctica, which isn't a country at all.
  const territoryNames = useMemo(() => countries.map((c) => c.properties.NAME).filter((name) => name in TERRITORY_PARENT), [countries])
  const hasAntarctica = useMemo(() => countries.some((c) => c.properties.NAME === 'Antarctica'), [countries])
  const territoriesByContinent = useMemo(() => {
    const groups = new Map<Continent, string[]>()
    for (const name of territoryNames) {
      const continent = CONTINENT_BY_COUNTRY[name]
      const list = groups.get(continent) ?? []
      list.push(name)
      groups.set(continent, list)
    }
    for (const list of groups.values()) list.sort((a, b) => a.localeCompare(b))
    return groups
  }, [territoryNames])

  const [hasStarted, setHasStarted] = useState(false)
  const [guessed, setGuessed] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(GAME_DURATION_SECONDS)
  const [isPaused, setIsPaused] = useState(false)
  const [hasGivenUp, setHasGivenUp] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const [showTerritories, setShowTerritories] = useState(false)
  const [viewingContinent, setViewingContinent] = useState<ViewingRegion | null>(null)
  const isGameOver = hasGivenUp || secondsLeft <= 0
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!hasStarted || isPaused || isGameOver) return
    const timeout = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(timeout)
  }, [hasStarted, secondsLeft, isPaused, isGameOver])

  // One anchor point per zone (each continent's countries averaged into a
  // single point on the sphere, plus Antarctica's own centroid), used below
  // to partition the entire globe — oceans included — into the nearest
  // zone by angular distance, rather than only naming a zone when the
  // camera happens to be over land.
  const viewingAnchors = useMemo(() => {
    const sums = new Map<ViewingRegion, [number, number, number]>()
    for (const name of guessableNames) {
      const centroid = centroidByName.get(name)
      if (!centroid) continue
      const continent = CONTINENT_BY_COUNTRY[name]
      const vec = toUnitVector(centroid[0], centroid[1])
      const sum = sums.get(continent) ?? [0, 0, 0]
      sums.set(continent, [sum[0] + vec[0], sum[1] + vec[1], sum[2] + vec[2]])
    }
    const antarctica = countries.find((c) => c.properties.NAME === 'Antarctica')
    if (antarctica) {
      const [lng, lat] = geoCentroid(antarctica)
      sums.set('Antarctica', toUnitVector(lng, lat))
    }
    const anchors = new Map<ViewingRegion, [number, number, number]>()
    for (const [region, [x, y, z]] of sums) {
      const length = Math.hypot(x, y, z) || 1
      anchors.set(region, [x / length, y / length, z / length])
    }
    return anchors
  }, [guessableNames, centroidByName, countries])

  // globe.gl has no "camera changed" event, so this polls pointOfView()
  // instead — cheap relative to the poll interval, same as checking 7
  // dot products every tick. Whichever zone anchor is angularly closest to
  // the current look-at point determines what's showing as "currently
  // viewing", covering ocean the same as land.
  useEffect(() => {
    if (!hasStarted || viewingAnchors.size === 0) return
    const interval = setInterval(() => {
      const globe = globeRef.current
      if (!globe) return
      const { lat, lng } = globe.pointOfView()
      const point = toUnitVector(lng, lat)
      let closest: ViewingRegion | null = null
      let bestDot = -Infinity
      for (const [region, anchor] of viewingAnchors) {
        const dot = point[0] * anchor[0] + point[1] * anchor[1] + point[2] * anchor[2]
        if (dot > bestDot) {
          bestDot = dot
          closest = region
        }
      }
      setViewingContinent(closest)
    }, VIEW_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [hasStarted, viewingAnchors, globeRef])

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
    globe.pointColor((d) => (isGuessedPoint(d) ? 'rgba(0,0,0,0)' : MISSING_POINT_COLOR)).pointRadius((d) => (isGuessedPoint(d) ? 0 : 0.3))
  }, [guessed, showMissing, globeRef])

  useEffect(() => {
    if (!isGameOver) return
    for (const name of guessableNames) {
      if (!guessed.has(name)) paintCountry(name, MISSED_COLOR)
    }
  }, [isGameOver, guessableNames, guessed, paintCountry])

  const handleInputChange = (value: string) => {
    setInput(value)
    const match = matchGuess(guessLookup, value)
    if (!match || guessed.has(match)) return

    setGuessed((prev) => new Set(prev).add(match))
    paintCountry(match, GUESSED_COLOR)
    setInput('')
  }

  const restart = () => {
    for (const name of guessableNames) paintCountry(name, LAND_COLOR)
    setGuessed(new Set())
    setInput('')
    setSecondsLeft(GAME_DURATION_SECONDS)
    setIsPaused(false)
    setHasGivenUp(false)
    setShowMissing(false)
    inputRef.current?.focus()
  }

  // During play, only the countries you've actually gotten show up (so the
  // list reads as a running tally). At game over, every country appears,
  // sorted alphabetically — guessed ones stay green, the rest turn red —
  // matching how these quizzes conventionally reveal the full answer key.
  const displayByContinent = useMemo(() => {
    const groups = new Map<Continent, { name: string; isGuessed: boolean }[]>()
    for (const name of guessableNames) {
      const isGuessed = guessed.has(name)
      if (!isGameOver && !isGuessed) continue
      const continent = CONTINENT_BY_COUNTRY[name]
      const list = groups.get(continent) ?? []
      list.push({ name, isGuessed })
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

  const isInputDisabled = isPaused || isGameOver

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', fontFamily: 'system-ui, sans-serif' }}>
      <GlobeStatus isLoading={isLoading} loadError={loadError} retry={retry} />
      {!hasStarted ? (
        <button
          type="button"
          onClick={() => {
            setHasStarted(true)
            inputRef.current?.focus()
          }}
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1,
            padding: '12px 20px',
            borderRadius: 8,
            border: 'none',
            background: '#4ade80',
            color: '#0a1312',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Start Quiz ▶
        </button>
      ) : (
        <>
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxWidth: 'calc(100vw - 32px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(10, 19, 18, 0.9)',
                color: '#e3ece9',
                fontSize: 14,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 700, color: secondsLeft <= 30 ? '#ef4444' : '#4ade80', minWidth: 48 }}>
                {formatTime(secondsLeft)}
              </span>
              {!isGameOver && (
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  style={{
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
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(event) => handleInputChange(event.target.value)}
                disabled={isInputDisabled}
                placeholder="Enter country's name here:"
                autoFocus
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  background: isInputDisabled ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                  color: '#e3ece9',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  width: 220,
                  outline: 'none',
                }}
              />
              <span>
                {guessed.size} / {guessableNames.length} guessed
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(10, 19, 18, 0.75)',
                color: '#e3ece9',
                fontSize: 13,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: 'rgba(227, 236, 233, 0.7)' }}>
                Viewing: <strong style={{ color: viewingContinent ? VIEWING_COLOR[viewingContinent] : '#e3ece9' }}>{viewingContinent ?? '—'}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowMissing((s) => !s)}
                style={{ padding: 0, border: 'none', background: 'none', color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
              >
                {showMissing ? 'Hide Missing Countries' : 'Show Missing Countries'}
              </button>
              <button
                type="button"
                onClick={() => setShowTerritories((s) => !s)}
                style={{ padding: 0, border: 'none', background: 'none', color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
              >
                {showTerritories ? 'Hide Territories & Other Data' : 'Show Territories & Other Data'}
              </button>
              <Link to="/" style={{ color: '#e3ece9' }}>
                Back to Explore
              </Link>
            </div>

            <div style={{ display: 'flex', gap: 12, maxHeight: 'calc(100vh - 180px)' }}>
              {CONTINENT_ORDER.map((continent) => {
                const entries = displayByContinent.get(continent) ?? []
                const progress = continentProgress.get(continent)
                return (
                  <div key={continent} style={{ ...panelStyle, width: 160, maxHeight: '100%', overflowY: 'auto' }}>
                    <div
                      style={{
                        padding: '6px 10px',
                        fontWeight: 700,
                        color: '#0a1312',
                        background: CONTINENT_COLOR[continent],
                        position: 'sticky',
                        top: 0,
                      }}
                    >
                      {continent} {progress ? `${progress.guessedCount}/${progress.total}` : ''}
                    </div>
                    {entries.map(({ name, isGuessed }) => (
                      <div key={name} style={{ padding: '4px 10px', color: isGuessed ? '#4ade80' : '#ef4444' }}>
                        {name}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {showTerritories && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 1,
                display: 'flex',
                gap: 12,
                maxHeight: 'calc(100vh - 32px)',
              }}
            >
              <div style={{ ...panelStyle, width: 220, maxHeight: '100%', overflowY: 'auto', color: '#e3ece9' }}>
                <div style={{ padding: '8px 10px', fontWeight: 700, position: 'sticky', top: 0, background: 'rgba(10, 19, 18, 0.97)' }}>
                  On the globe, not in the quiz
                </div>
                <div style={{ padding: '0 10px 8px', fontSize: 12, color: 'rgba(227, 236, 233, 0.6)' }}>
                  Dependent territories and Antarctica render on the map but aren't guessable countries.
                </div>
                {hasAntarctica && (
                  <div style={{ padding: '4px 10px', color: 'rgba(227, 236, 233, 0.9)' }}>Antarctica</div>
                )}
                {CONTINENT_ORDER.map((continent) => {
                  const names = territoriesByContinent.get(continent)
                  if (!names || names.length === 0) return null
                  return (
                    <div key={continent}>
                      <div
                        style={{
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                          color: CONTINENT_COLOR[continent],
                        }}
                      >
                        {continent}
                      </div>
                      {names.map((name) => (
                        <div key={name} style={{ padding: '4px 10px', color: 'rgba(227, 236, 233, 0.9)' }}>
                          {name} <span style={{ color: 'rgba(227, 236, 233, 0.5)' }}>({TERRITORY_PARENT[name]})</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default WorldQuiz
