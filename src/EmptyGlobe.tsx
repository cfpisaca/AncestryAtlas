import { useEffect } from 'react'
import { Color } from 'three'
import GlobeStatus from './GlobeStatus'
import { useWorldGlobe } from './useWorldGlobe'

// Matches useWorldGlobe's OCEAN_MATERIAL color exactly, so painting every
// country this color makes them blend into the ocean — a blank globe to
// prototype a new mechanic on top of, without touching the shared hook.
const OCEAN_COLOR = new Color('#0b1f2e')

// Fills whatever box its parent gives it — BlankMapPrototype owns the page
// chrome (back link, mode toggle, the bounded box itself) so this and
// EmptyMap2D can be swapped inside it.
function EmptyGlobe() {
  const { containerRef, countries, paintCountry, isLoading, loadError, retry } = useWorldGlobe()

  useEffect(() => {
    for (const country of countries) paintCountry(country.properties.NAME, OCEAN_COLOR)
  }, [countries, paintCountry])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <GlobeStatus isLoading={isLoading} loadError={loadError} retry={retry} />
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default EmptyGlobe
