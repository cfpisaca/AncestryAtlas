import { Link } from 'react-router-dom'
import USMap2D, { MAP_ASPECT_RATIO } from './USMap2D'

// A first, minimal look at the US states map — second concrete example
// (after the world map) for the "interactive diagram" pattern discussed
// alongside this: get the actual map rendering and interacting correctly
// first, before judging what's genuinely shared with WorldMap2D vs what's
// just superficially similar.
function USMapPrototype() {
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
      <Link
        to="/"
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(10, 19, 18, 0.85)',
          color: '#e3ece9',
          fontSize: 14,
          textDecoration: 'none',
        }}
      >
        ← Back to Menu
      </Link>

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
        <USMap2D />
      </div>
    </div>
  )
}

export default USMapPrototype
