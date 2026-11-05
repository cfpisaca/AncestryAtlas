import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { CONTINENT_BY_COUNTRY, TERRITORY_PARENT } from './continents'
import WorldMap2D, { MAP_ASPECT_RATIO } from './WorldMap2D'
import type { CountryFeature } from './useWorldGlobe'

const CORRECT_COLOR = '#4ade80'
const WRONG_FLASH_COLOR = '#ef4444'
// How long a wrong click's red flash stays up before the country reverts to
// its normal color — long enough to register as feedback, short enough not
// to block the next attempt.
const WRONG_FLASH_MS = 500

const chromeButtonStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  zIndex: 10,
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255, 255, 255, 0.2)',
  background: 'rgba(10, 19, 18, 0.85)',
  color: '#e3ece9',
  fontSize: 14,
  fontFamily: 'inherit',
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// A click-to-identify quiz on the flat 2D map: "Click: France" instead of
// typing it, built on top of WorldMap2D's generic onCountryClick/countryFill
// props. Only sovereign countries are guessable targets (same filter
// WorldQuiz uses), so the count matches the rest of the site's "197
// countries" — territories are still on the map and still clickable, they
// just never come up as a target, same as clicking ocean.
function ClickQuiz() {
  const [pool, setPool] = useState<string[]>([])
  const [target, setTarget] = useState<string | null>(null)
  const [correct, setCorrect] = useState<Set<string>>(new Set())
  const [wrongFlash, setWrongFlash] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const wrongFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCountriesLoaded = useCallback((countries: CountryFeature[]) => {
    const guessableNames = countries
      .map((c) => c.properties.NAME)
      .filter((name) => name in CONTINENT_BY_COUNTRY && !(name in TERRITORY_PARENT))
    const [first, ...rest] = shuffled(guessableNames)
    setTotal(guessableNames.length)
    setTarget(first ?? null)
    setPool(rest)
  }, [])

  const restart = useCallback(() => {
    setCorrect(new Set())
    setWrongFlash(null)
    if (wrongFlashTimeout.current) clearTimeout(wrongFlashTimeout.current)
    const all = [...pool, ...(target ? [target] : []), ...correct]
    const [first, ...rest] = shuffled(all)
    setTarget(first ?? null)
    setPool(rest)
  }, [pool, target, correct])

  const handleCountryClick = useCallback(
    (name: string) => {
      if (!target) return
      if (name === target) {
        setCorrect((prev) => new Set(prev).add(name))
        setPool((prevPool) => {
          const [next, ...rest] = shuffled(prevPool)
          setTarget(next ?? null)
          return rest
        })
        return
      }
      setWrongFlash(name)
      if (wrongFlashTimeout.current) clearTimeout(wrongFlashTimeout.current)
      wrongFlashTimeout.current = setTimeout(() => setWrongFlash(null), WRONG_FLASH_MS)
    },
    [target],
  )

  const countryFill = useCallback(
    (name: string) => {
      if (correct.has(name)) return CORRECT_COLOR
      if (wrongFlash === name) return WRONG_FLASH_COLOR
      return undefined
    },
    [correct, wrongFlash],
  )

  const isComplete = total > 0 && correct.size === total

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#000',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <Link to="/" style={{ ...chromeButtonStyle, left: 16, textDecoration: 'none' }}>
        ← Back to Menu
      </Link>

      <div style={{ ...chromeButtonStyle, position: 'static', fontWeight: 600 }}>
        {isComplete ? `🎉 Complete! ${total}/${total}` : target ? `Click: ${target}` : 'Loading…'}
        {!isComplete && total > 0 && (
          <span style={{ marginLeft: 10, fontWeight: 400, color: 'rgba(227, 236, 233, 0.7)' }}>
            {correct.size} / {total}
          </span>
        )}
      </div>

      {isComplete && (
        <button
          type="button"
          onClick={restart}
          style={{ ...chromeButtonStyle, position: 'static', cursor: 'pointer', background: '#4ade80', color: '#0a1312', fontWeight: 700 }}
        >
          Play Again
        </button>
      )}

      <div
        style={{
          width: '90%',
          maxWidth: 1100,
          aspectRatio: MAP_ASPECT_RATIO,
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
        }}
      >
        <WorldMap2D onCountriesLoaded={handleCountriesLoaded} onCountryClick={handleCountryClick} countryFill={countryFill} />
      </div>
    </div>
  )
}

export default ClickQuiz
