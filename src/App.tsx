import { useEffect, useRef } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'

function App() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return

    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.2 })
    globe.controls().autoRotate = true
    globe.controls().autoRotateSpeed = 0.4
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      />
    </div>
  )
}

export default App
