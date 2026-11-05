import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildGuessLookup, matchGuess } from './guessMatching'
import { ALL_TEAMS, CONFERENCE_BY_TEAM, CONFERENCE_ORDER, NBA_TEAM_ALIASES, type Conference } from './nbaTeams'

const GUESSED_COLOR = '#4ade80'
const MISSED_COLOR = '#ef4444'
const HIGHLIGHT_COLOR = '#fbbf24'
const GAME_DURATION_SECONDS = 10 * 60

const CONFERENCE_COLOR: Record<Conference, string> = {
  Eastern: '#60a5fa',
  Western: '#fb923c',
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Same type-the-answer mechanic as WorldQuiz/CapitalsQuiz, but with no
// globe/map at all — there's no spatial visual that makes sense for "name
// the NBA teams", so this is a plain centered page instead of reusing
// Sidebar (which exists specifically to share screen space with a globe;
// there's nothing here for it to share space with). A 30-item list also
// fits on screen without needing WorldQuiz's collapsible-by-group,
// most-recent-first treatment — both conferences stay visible throughout,
// each team in a fixed alphabetical slot that fills in as guessed.
function NBAQuiz() {
  const [hasStarted, setHasStarted] = useState(false)
  const [guessed, setGuessed] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(GAME_DURATION_SECONDS)
  const [isPaused, setIsPaused] = useState(false)
  const [hasGivenUp, setHasGivenUp] = useState(false)
  const [lastGuessed, setLastGuessed] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isComplete = guessed.size === ALL_TEAMS.length
  const isGameOver = hasGivenUp || secondsLeft <= 0 || isComplete
  const guessLookup = useMemo(() => buildGuessLookup([...ALL_TEAMS], NBA_TEAM_ALIASES), [])

  useEffect(() => {
    if (!hasStarted || isPaused || isGameOver) return
    const timeout = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(timeout)
  }, [hasStarted, secondsLeft, isPaused, isGameOver])

  useEffect(() => {
    if (hasStarted) inputRef.current?.focus()
  }, [hasStarted])

  const handleInputChange = (value: string) => {
    setInput(value)
    const match = matchGuess(guessLookup, value)
    if (!match || guessed.has(match)) return
    setGuessed((prev) => new Set(prev).add(match))
    setLastGuessed(match)
    setInput('')
  }

  const restart = () => {
    setGuessed(new Set())
    setInput('')
    setSecondsLeft(GAME_DURATION_SECONDS)
    setIsPaused(false)
    setHasGivenUp(false)
    setLastGuessed(null)
    inputRef.current?.focus()
  }

  const teamsByConference = useMemo(() => {
    const groups = new Map<Conference, string[]>()
    for (const team of ALL_TEAMS) {
      const conference = CONFERENCE_BY_TEAM[team]
      const list = groups.get(conference) ?? []
      list.push(team)
      groups.set(conference, list)
    }
    for (const list of groups.values()) list.sort((a, b) => a.localeCompare(b))
    return groups
  }, [])

  const isInputDisabled = !hasStarted || isPaused || isGameOver

  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#000',
        color: '#e3ece9',
        fontFamily: 'system-ui, sans-serif',
        padding: '24px 20px 60px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            }}
          >
            ← Back to Menu
          </Link>
          <span
            style={{
              fontSize: isComplete ? 16 : 24,
              fontWeight: 700,
              color: isComplete ? HIGHLIGHT_COLOR : secondsLeft <= 30 ? '#ef4444' : '#4ade80',
            }}
          >
            {isComplete ? `🎉 Complete in ${formatTime(GAME_DURATION_SECONDS - secondsLeft)}` : formatTime(secondsLeft)}
          </span>
          {hasStarted ? (
            <span style={{ fontSize: 13, color: 'rgba(227, 236, 233, 0.7)' }}>
              {guessed.size} / {ALL_TEAMS.length} guessed
            </span>
          ) : (
            <span />
          )}
        </div>

        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, textAlign: 'center' }}>🏀 Name the NBA Teams</h1>

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
            🎉 All {ALL_TEAMS.length} teams guessed with {formatTime(secondsLeft)} to spare!
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasStarted ? (
            <input
              ref={inputRef}
              type="text"
              className="quiz-guess-input"
              value={input}
              onChange={(event) => handleInputChange(event.target.value)}
              disabled={isInputDisabled}
              placeholder="Type your guess..."
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{
                flex: 1,
                minWidth: 0,
                height: 40,
                boxSizing: 'border-box',
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.3)',
                background: isInputDisabled ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                color: '#e3ece9',
                fontFamily: 'inherit',
                fontSize: 15,
                outline: 'none',
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setHasStarted(true)}
              style={{
                flex: 1,
                height: 40,
                boxSizing: 'border-box',
                borderRadius: 6,
                border: 'none',
                background: '#4ade80',
                color: '#0a1312',
                fontWeight: 700,
                fontSize: 14,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Start Quiz ▶
            </button>
          )}
          {hasStarted && !isGameOver && (
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              style={{
                padding: '0 14px',
                height: 40,
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
          {hasStarted && (
            <button
              type="button"
              onClick={() => (isGameOver ? restart() : setHasGivenUp(true))}
              style={{
                padding: '0 14px',
                height: 40,
                borderRadius: 6,
                border: 'none',
                background: '#ef4444',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {isGameOver ? 'Play Again' : 'Give Up?'}
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {CONFERENCE_ORDER.map((conference) => {
            const teams = teamsByConference.get(conference) ?? []
            const guessedCount = teams.filter((t) => guessed.has(t)).length
            return (
              <div key={conference}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: CONFERENCE_COLOR[conference], flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {conference} Conference {guessedCount}/{teams.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {teams.map((team) => {
                    const isGuessed = guessed.has(team)
                    const reveal = isGuessed || isGameOver
                    return (
                      <div
                        key={team}
                        style={{
                          padding: '7px 10px',
                          borderRadius: 6,
                          border: !isGameOver && team === lastGuessed ? `1px solid ${HIGHLIGHT_COLOR}` : '1px solid rgba(255, 255, 255, 0.08)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          color: reveal ? (isGuessed ? GUESSED_COLOR : MISSED_COLOR) : 'rgba(227, 236, 233, 0.35)',
                          fontSize: 14,
                        }}
                      >
                        {reveal ? team : '?????'}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default NBAQuiz
