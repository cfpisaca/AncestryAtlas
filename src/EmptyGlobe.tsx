import { useEffect } from 'react'
import { Color } from 'three'
import { Link } from 'react-router-dom'
import GlobeStatus from './GlobeStatus'
import { useWorldGlobe } from './useWorldGlobe'
import { useVisibleViewportHeight } from './useVisibleViewportHeight'

// Matches useWorldGlobe's OCEAN_MATERIAL color exactly, so painting every
// country this color makes them blend into the ocean — a blank globe to
// prototype a new mechanic on top of, without touching the shared hook.
const OCEAN_COLOR = new Color('#0b1f2e')

function EmptyGlobe() {
  const visibleHeight = useVisibleViewportHeight()
  const { containerRef, countries, paintCountry, isLoading, loadError, retry } = useWorldGlobe()

  useEffect(() => {
    for (const country of countries) paintCountry(country.properties.NAME, OCEAN_COLOR)
  }, [countries, paintCountry])

  return (
    <div style={{ width: '100vw', height: visibleHeight, display: 'flex' }}>
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
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <GlobeStatus isLoading={isLoading} loadError={loadError} retry={retry} />
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

export default EmptyGlobe
