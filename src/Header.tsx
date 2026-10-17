import { useState } from 'react'

// Pure UI shell for now — search, login/signup, and language are all
// non-functional placeholders. No backend/auth/i18n wired up yet; see
// project discussion for why (deliberately deferred, not an oversight).
function Header() {
  const [searchValue, setSearchValue] = useState('')

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(10, 19, 18, 0.92)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>
        🌍 Ancestry Atlas
      </div>

      <input
        type="text"
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        placeholder="Search game modes..."
        style={{
          flex: '1 1 200px',
          minWidth: 0,
          maxWidth: 420,
          height: 36,
          boxSizing: 'border-box',
          padding: '0 12px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(255, 255, 255, 0.08)',
          color: '#e3ece9',
          fontFamily: 'inherit',
          fontSize: 14,
          outline: 'none',
        }}
      />

      <div style={{ flex: 1 }} />

      <button
        type="button"
        title="Coming soon"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 36,
          padding: '0 10px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(255, 255, 255, 0.08)',
          color: '#e3ece9',
          fontSize: 13,
          fontFamily: 'inherit',
          cursor: 'default',
        }}
      >
        🌐 EN
      </button>

      <button
        type="button"
        title="Coming soon"
        style={{
          height: 36,
          padding: '0 14px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'transparent',
          color: '#e3ece9',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'default',
        }}
      >
        Log In
      </button>

      <button
        type="button"
        title="Coming soon"
        style={{
          height: 36,
          padding: '0 14px',
          borderRadius: 8,
          border: 'none',
          background: '#4ade80',
          color: '#0a1312',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'default',
        }}
      >
        Sign Up
      </button>
    </header>
  )
}

export default Header
