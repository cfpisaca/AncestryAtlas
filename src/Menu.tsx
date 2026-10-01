import { Link } from 'react-router-dom'

function Menu() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#e3ece9',
        fontFamily: 'system-ui, sans-serif',
        padding: '20px',
        boxSizing: 'border-box',
        gap: 40,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, fontWeight: 700, margin: '0 0 12px 0' }}>Ancestry Atlas</h1>
        <p style={{ fontSize: 16, color: 'rgba(227, 236, 233, 0.7)', margin: 0 }}>Geography Quiz</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400, width: '100%' }}>
        <Link
          to="/quiz"
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
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🌍 Countries</div>
          <div style={{ fontSize: 14, color: 'rgba(227, 236, 233, 0.7)' }}>Guess all 197 countries</div>
        </Link>

        <Link
          to="/capitals"
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
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🏛️ Capitals</div>
          <div style={{ fontSize: 14, color: 'rgba(227, 236, 233, 0.7)' }}>Guess capital cities</div>
        </Link>

        <Link
          to="/explore"
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
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🔍 Explore</div>
          <div style={{ fontSize: 14, color: 'rgba(227, 236, 233, 0.7)' }}>Browse the world map</div>
        </Link>
      </div>
    </div>
  )
}

export default Menu
