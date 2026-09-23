import { useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid } from 'd3'
import { Link } from 'react-router-dom'
import { Color } from 'three'
import { buildGuessLookup, matchGuess } from './countryAliases'
import { CONTINENT_BY_COUNTRY, CONTINENT_ORDER, TERRITORY_PARENT } from './continents'
import { LAND_COLOR, useWorldGlobe } from './useWorldGlobe'

const GUESSED_COLOR = new Color('#4ade80')
const MISSED_COLOR = new Color('#ef4444')
const MISSING_POINT_COLOR = '#fbbf24'
const GAME_DURATION_SECONDS = 15 * 60

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function WorldQuiz() {
  const { containerRef, globeRef, countries, paintCountry } = useWorldGlobe({ autoRotate: false })

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

  const [hasStarted, setHasStarted] = useState(false)
  const [guessed, setGuessed] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(GAME_DURATION_SECONDS)
  const [isPaused, setIsPaused] = useState(false)
  const [hasGivenUp, setHasGivenUp] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const isGameOver = hasGivenUp || secondsLeft <= 0
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!hasStarted || isPaused || isGameOver) return
    const timeout = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(timeout)
  }, [hasStarted, secondsLeft, isPaused, isGameOver])

  // A location hint, not an answer reveal: small dots at each unguessed
  // country's centroid (matching how these quizzes conventionally offer a
  // "where" hint without giving away the name or shape), toggleable at any
  // time without pausing or ending the game.
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    if (!showMissing) {
      globe.pointsData([])
      return
    }
    const points = guessableNames
      .filter((name) => !guessed.has(name))
      .map((name) => centroidByName.get(name))
      .filter((centroid): centroid is [number, number] => centroid !== undefined)
      .map(([lng, lat]) => ({ lat, lng }))
    globe
      .pointsData(points)
      .pointLat('lat')
      .pointLng('lng')
      .pointColor(() => MISSING_POINT_COLOR)
      .pointRadius(0.3)
      .pointAltitude(0.01)
  }, [showMissing, guessed, guessableNames, centroidByName, globeRef])

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
    const groups = new Map<string, { name: string; isGuessed: boolean }[]>()
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

  const isInputDisabled = isPaused || isGameOver

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', fontFamily: 'system-ui, sans-serif' }}>
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
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(10, 19, 18, 0.9)',
              color: '#e3ece9',
              fontSize: 14,
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
            <button
              type="button"
              onClick={() => setShowMissing((s) => !s)}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: '#60a5fa',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            >
              {showMissing ? 'Hide Missing Countries' : 'Show Missing Countries'}
            </button>
            <Link to="/" style={{ color: '#e3ece9' }}>
              Back to Explore
            </Link>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 70,
              left: 16,
              zIndex: 1,
              display: 'flex',
              gap: 12,
              maxHeight: 'calc(100vh - 100px)',
            }}
          >
            {CONTINENT_ORDER.map((continent) => {
              const entries = displayByContinent.get(continent)
              if (!entries || entries.length === 0) return null
              return (
                <div
                  key={continent}
                  style={{
                    width: 160,
                    maxHeight: '100%',
                    overflowY: 'auto',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(10, 19, 18, 0.85)',
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      padding: '6px 10px',
                      fontWeight: 700,
                      color: '#0a1312',
                      background: '#4ade80',
                      position: 'sticky',
                      top: 0,
                    }}
                  >
                    {continent}
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
        </>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default WorldQuiz
