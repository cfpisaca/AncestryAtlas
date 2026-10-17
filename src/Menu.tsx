import { Link } from 'react-router-dom'
import Header from './Header'

interface GameMode {
  to: string
  icon: string
  title: string
  description: string
}

const GAME_MODES: GameMode[] = [
  { to: '/countries', icon: '🌍', title: 'Countries', description: 'Guess all 197 countries' },
  { to: '/capitals', icon: '🏛️', title: 'Capitals', description: 'Guess capital cities' },
  { to: '/explore', icon: '🔍', title: 'Explore', description: 'Browse the world map' },
]

function ModeCard({ to, icon, title, description }: GameMode) {
  return (
    <Link
      to={to}
      style={{
        padding: '20px',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        background: 'rgba(255, 255, 255, 0.08)',
        color: '#e3ece9',
        textDecoration: 'none',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: 14, color: 'rgba(227, 236, 233, 0.7)' }}>{description}</div>
    </Link>
  )
}

function Menu() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#000', color: '#e3ece9', fontFamily: 'system-ui, sans-serif' }}>
      <Header />

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', boxSizing: 'border-box', gap: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 40, fontWeight: 700, margin: '0 0 12px 0' }}>Ancestry Atlas</h1>
          <p style={{ fontSize: 16, color: 'rgba(227, 236, 233, 0.7)', margin: 0 }}>Geography Quiz</p>
        </div>

        <section style={{ width: '100%', maxWidth: 900 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px 0', color: 'rgba(227, 236, 233, 0.9)' }}>Game Modes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {GAME_MODES.map((mode) => (
              <ModeCard key={mode.to} {...mode} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Menu
