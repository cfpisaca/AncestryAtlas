import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import EmptyGlobe from './EmptyGlobe'
import EmptyMap2D from './EmptyMap2D'

type ViewMode = '3d' | '2d'

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

// Combines the two blank-map prototypes behind a single toggle, so they can
// be compared side by side (well, one at a time) in the same box instead of
// living on separate full-page routes. Both stay mounted and are swapped
// with CSS display rather than conditional rendering — unmounting would
// re-fetch the world topology and, for the globe, rebuild its merged land
// mesh (not cheap, see useWorldGlobe) on every single toggle.
function BlankMapPrototype() {
  const [mode, setMode] = useState<ViewMode>('3d')

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <Link to="/" style={{ ...chromeButtonStyle, left: 16, textDecoration: 'none' }}>
        ← Back to Menu
      </Link>

      <button
        type="button"
        onClick={() => setMode((m) => (m === '3d' ? '2d' : '3d'))}
        style={{ ...chromeButtonStyle, right: 16, cursor: 'pointer' }}
      >
        Switch to {mode === '3d' ? '2D' : '3D'}
      </button>

      <div
        style={{
          width: '90%',
          maxWidth: 1100,
          aspectRatio: '16 / 9',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: '100%', height: '100%', display: mode === '3d' ? 'block' : 'none' }}>
          <EmptyGlobe active={mode === '3d'} />
        </div>
        <div style={{ width: '100%', height: '100%', display: mode === '2d' ? 'block' : 'none' }}>
          <EmptyMap2D />
        </div>
      </div>
    </div>
  )
}

export default BlankMapPrototype
