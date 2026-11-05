import { useEffect } from 'react'
import { Color } from 'three'
import GlobeStatus from './GlobeStatus'
import { useWorldGlobe } from './useWorldGlobe'

// Matches useWorldGlobe's OCEAN_MATERIAL color exactly, so painting every
// country this color makes them blend into the ocean — a blank globe to
// prototype a new mechanic on top of, without touching the shared hook.
const OCEAN_COLOR = new Color('#0b1f2e')

interface EmptyGlobeProps {
  active?: boolean
}

// Fills whatever box its parent gives it — BlankMapPrototype owns the page
// chrome (back link, mode toggle, the bounded box itself) so this and
// WorldMap2D can be swapped inside it.
function EmptyGlobe({ active = true }: EmptyGlobeProps) {
  const { containerRef, globeRef, countries, paintCountry, isLoading, loadError, retry } = useWorldGlobe({
    autoRotate: false,
  })

  useEffect(() => {
    for (const country of countries) paintCountry(country.properties.NAME, OCEAN_COLOR)
  }, [countries, paintCountry])

  // BlankMapPrototype keeps both prototypes mounted and hides the inactive
  // one with display: none rather than unmounting it. Without this, the
  // globe's requestAnimationFrame render loop keeps driving WebGL draw
  // calls at full tilt in the background even while hidden, competing with
  // the 2D map's own interaction handling for the main thread and making
  // its panning/zooming visibly janky.
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    if (active) globe.resumeAnimation()
    else globe.pauseAnimation()
  }, [active, globeRef])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <GlobeStatus isLoading={isLoading} loadError={loadError} retry={retry} />
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default EmptyGlobe
