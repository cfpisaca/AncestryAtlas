import { useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid } from 'd3'
import { Link } from 'react-router-dom'
import { Color } from 'three'
import { buildGuessLookup, matchGuess } from './countryAliases'
import { CONTINENT_BY_COUNTRY, CONTINENT_ORDER, TERRITORY_PARENT, type Continent } from './continents'
import GlobeStatus from './GlobeStatus'
import Sidebar from './Sidebar'
import { altitudeForCountry, HIGHLIGHT_COLOR, LAND_COLOR, useWorldGlobe, type CountryFeature } from './useWorldGlobe'
import { useVisibleViewportHeight } from './useVisibleViewportHeight'
import { CAPITALS_BY_COUNTRY } from './capitals'

const GUESSED_COLOR = new Color('#4ade80')
const MISSED_COLOR = new Color('#ef4444')
const GAME_DURATION_SECONDS = 15 * 60

const CONTINENT_COLOR: Record<Continent, string> = {
  Africa: '#c084fc',
  Asia: '#f87171',
  Europe: '#60a5fa',
  'North America': '#fb923c',
  Oceania: '#22d3ee',
  'South America': '#4ade80',
}

const PARENT_LABEL_TO_COUNTRY: Record<string, string> = {
  US: 'United States of America',
  UK: 'United Kingdom',
}

const TERRITORIES_BY_COUNTRY: Record<string, string[]> = {}
for (const [territory, label] of Object.entries(TERRITORY_PARENT)) {
  const parent = PARENT_LABEL_TO_COUNTRY[label] ?? label
  const list = TERRITORIES_BY_COUNTRY[parent] ?? []
  list.push(territory)
  TERRITORIES_BY_COUNTRY[parent] = list
}
for (const list of Object.values(TERRITORIES_BY_COUNTRY)) list.sort((a, b) => a.localeCompare(b))

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function CapitalsQuiz() {
  const [hasStarted, setHasStarted] = useState(false)
  const [guessed, setGuessed] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(GAME_DURATION_SECONDS)
  const [isPaused, setIsPaused] = useState(false)
  const [hasGivenUp, setHasGivenUp] = useState(false)
  const [expandedContinent, setExpandedContinent] = useState<Continent | null>(null)
  const [lastGuessed, setLastGuessed] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const visibleHeight = useVisibleViewportHeight()

  const { containerRef, globeRef, countries, paintCountry, highlightCountry, isLoading, loadError, retry } = useWorldGlobe({
    autoRotate: false,
  })

  const guessableNames = useMemo(
    () =>
      countries
        .map((c) => c.properties.NAME)
        .filter((name) => name in CONTINENT_BY_COUNTRY && !(name in TERRITORY_PARENT) && name in CAPITALS_BY_COUNTRY),
    [countries],
  )
  const countryByName = useMemo(() => new Map(countries.map((c) => [c.properties.NAME, c])), [countries])

  const isComplete = guessed.size > 0 && guessed.size === guessableNames.length
  const isGameOver = hasGivenUp || secondsLeft <= 0 || isComplete

  // Guesses are capital names, not country names — the input needs to match
  // against "Paris", not "France". countryByCapital resolves a matched
  // capital back to the country it belongs to so the rest of the game state
  // (guessed set, continent grouping) can keep tracking countries the same
  // way WorldQuiz does.
  const capitalNames = useMemo(() => guessableNames.map((name) => CAPITALS_BY_COUNTRY[name]), [guessableNames])
  const countryByCapital = useMemo(
    () => new Map(guessableNames.map((name) => [CAPITALS_BY_COUNTRY[name], name])),
    [guessableNames],
  )
  const guessLookup = useMemo(() => {
    const lookup = buildGuessLookup(capitalNames)
    // "Washington, D.C." normalizes to "washington d c" — the comma and
    // periods become spaces around each letter, so neither the common
    // short answer "Washington" nor "Washington DC" would otherwise match.
    if (countryByCapital.has('Washington, D.C.')) {
      lookup.set('washington', 'Washington, D.C.')
      lookup.set('washington dc', 'Washington, D.C.')
    }
    return lookup
  }, [capitalNames, countryByCapital])

  useEffect(() => {
    if (!hasStarted || isPaused || isGameOver) return
    const timeout = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(timeout)
  }, [hasStarted, secondsLeft, isPaused, isGameOver])

  useEffect(() => {
    if (hasStarted) inputRef.current?.focus()
  }, [hasStarted])

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
    const matchedCapital = matchGuess(guessLookup, value)
    const country = matchedCapital ? countryByCapital.get(matchedCapital) : undefined
    if (!country || guessed.has(country)) return

    setGuessed((prev) => new Set(prev).add(country))
    setLastGuessed(country)
    paintCountry(country, GUESSED_COLOR)
    const territoryNames = TERRITORIES_BY_COUNTRY[country] ?? []
    for (const territory of territoryNames) paintCountry(territory, GUESSED_COLOR)
    setExpandedContinent(CONTINENT_BY_COUNTRY[country])
    const globe = globeRef.current
    const feature = countryByName.get(country)
    if (globe && feature) {
      const [lng, lat] = geoCentroid(feature)
      globe.pointOfView({ lat, lng, altitude: altitudeForCountry(feature) }, 1200)
    }
    const territoryFeatures = territoryNames
      .map((name) => countryByName.get(name))
      .filter((f): f is CountryFeature => f !== undefined)
    highlightCountry(feature ? [feature, ...territoryFeatures] : territoryFeatures)
    setInput('')
  }

  const restart = () => {
    for (const name of guessableNames) {
      paintCountry(name, LAND_COLOR)
      for (const territory of TERRITORIES_BY_COUNTRY[name] ?? []) paintCountry(territory, LAND_COLOR)
    }
    highlightCountry(null)
    setGuessed(new Set())
    setInput('')
    setSecondsLeft(GAME_DURATION_SECONDS)
    setIsPaused(false)
    setHasGivenUp(false)
    setExpandedContinent(null)
    setLastGuessed(null)
    inputRef.current?.focus()
  }

  const displayByContinent = useMemo(() => {
    const groups = new Map<Continent, { name: string; isGuessed: boolean }[]>()
    const namesInOrder = isGameOver ? guessableNames : [...guessed].reverse()
    for (const name of namesInOrder) {
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

  const orderedContinents = useMemo(() => {
    if (isGameOver || !expandedContinent) return CONTINENT_ORDER
    return [expandedContinent, ...CONTINENT_ORDER.filter((c) => c !== expandedContinent)]
  }, [expandedContinent, isGameOver])

  const isInputDisabled = !hasStarted || isPaused || isGameOver

  return (
    <div style={{ width: '100vw', height: visibleHeight, display: 'flex' }}>
      <Sidebar
        persistent={(toggle) => (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: isComplete ? 16 : 24, fontWeight: 700, color: isComplete ? HIGHLIGHT_COLOR : secondsLeft <= 30 ? '#ef4444' : '#4ade80' }}>
                {isComplete ? `🎉 Complete in ${formatTime(GAME_DURATION_SECONDS - secondsLeft)}` : formatTime(secondsLeft)}
              </span>
              {hasStarted && (
                <span style={{ fontSize: 13, color: 'rgba(227, 236, 233, 0.7)' }}>
                  {guessed.size} / {guessableNames.length} guessed
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasStarted ? (
                <input
                  ref={inputRef}
                  type="text"
                  className="quiz-guess-input"
                  value={input}
                  onChange={(event) => handleInputChange(event.target.value)}
                  disabled={isInputDisabled}
                  placeholder="Type a capital city..."
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 36,
                    boxSizing: 'border-box',
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    background: isInputDisabled ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                    color: '#e3ece9',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setHasStarted(true)}
                  style={{
                    flex: 1,
                    height: 36,
                    boxSizing: 'border-box',
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
              {toggle}
            </div>
          </>
        )}
      >
        <>
          {isComplete && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${HIGHLIGHT_COLOR}66`,
                background: `${HIGHLIGHT_COLOR}1f`,
                color: HIGHLIGHT_COLOR,
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              🎉 All {guessableNames.length} capitals guessed with {formatTime(secondsLeft)} to spare!
            </div>
          )}
          {hasStarted && (
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
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
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
              ← Back to Menu
            </Link>
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />

          {orderedContinents.map((continent) => {
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
                  entries.map(({ name, isGuessed }) => (
                    <div key={name}>
                      <div
                        style={{
                          padding: '4px 6px 4px 16px',
                          borderRadius: 4,
                          border: !isGameOver && name === lastGuessed ? `1px solid ${HIGHLIGHT_COLOR}` : '1px solid transparent',
                        }}
                      >
                        <div style={{ color: isGuessed ? '#4ade80' : '#ef4444' }}>
                          {isGuessed || isGameOver ? CAPITALS_BY_COUNTRY[name] : '?????'}
                        </div>
                        <div style={{ color: 'rgba(227, 236, 233, 0.5)', fontSize: 11 }}>{name}</div>
                      </div>
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

export default CapitalsQuiz
