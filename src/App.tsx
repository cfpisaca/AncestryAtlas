import { useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid } from 'd3'
import type { Feature, Position } from 'geojson'
import { polygonToCells } from 'h3-js'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { MeshPhongMaterial } from 'three'
import worldTopologyData from 'world-atlas/countries-110m.json'

const H3_RESOLUTION = 4

function ringIsHexBinnable(ringCoords: Position[][]): boolean {
  try {
    polygonToCells(ringCoords, H3_RESOLUTION, true)
    return true
  } catch {
    return false
  }
}

// react-globe.gl's hex-binning (h3-js) throws on a handful of individual rings
// in the Natural Earth data instead of skipping them, which would otherwise
// abort rendering every country queued after the failure — e.g. North Korea
// has one 4-point ring that collapses to a single repeated coordinate (a
// zero-area artifact from polygon simplification). Dropping just the
// offending ring, not the whole country, keeps its real geometry intact.
function sanitizeForHexBinning(country: Feature): Feature | null {
  const geometry = country.geometry
  if (geometry.type === 'Polygon') {
    return ringIsHexBinnable(geometry.coordinates) ? country : null
  }
  if (geometry.type === 'MultiPolygon') {
    const rings = geometry.coordinates.filter(ringIsHexBinnable)
    if (rings.length === 0) return null
    return { ...country, geometry: { ...geometry, coordinates: rings } }
  }
  return country
}

const worldTopology = worldTopologyData as unknown as Topology
const countries = (
  feature(worldTopology, worldTopology.objects.countries as GeometryCollection)
    .features as Feature[]
)
  .filter((country) => country.properties?.name !== 'Antarctica')
  .map(sanitizeForHexBinning)
  .filter((country): country is Feature => country !== null)

const countryByName = new Map(
  countries.map((country) => [country.properties?.name as string, country]),
)
const countryNames = [...countryByName.keys()].sort((a, b) => a.localeCompare(b))

const OCEAN_MATERIAL = new MeshPhongMaterial({ color: '#0b1f2e' })
const LAND_COLOR = '#3fae8f'
const SELECTED_COLOR = '#f2b134'

function App() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [selectedName, setSelectedName] = useState('')

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return

    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.2 })
    globe.controls().autoRotate = true
    globe.controls().autoRotateSpeed = 0.4
  }, [])

  const flyToCountry = (name: string) => {
    setSelectedName(name)

    const globe = globeRef.current
    const country = countryByName.get(name)
    if (!globe) return

    if (!country) {
      globe.controls().autoRotate = true
      globe.pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 1200)
      return
    }

    globe.controls().autoRotate = false
    const [lng, lat] = geoCentroid(country)
    globe.pointOfView({ lat, lng, altitude: 1.4 }, 1200)
  }

  const hexColor = useMemo(
    () => (country: object) =>
      (country as Feature).properties?.name === selectedName ? SELECTED_COLOR : LAND_COLOR,
    [selectedName],
  )

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <select
        value={selectedName}
        onChange={(event) => flyToCountry(event.target.value)}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1,
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(10, 19, 18, 0.85)',
          color: '#e3ece9',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
        }}
      >
        <option value="">All countries</option>
        {countryNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <Globe
        ref={globeRef}
        globeMaterial={OCEAN_MATERIAL}
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        showAtmosphere
        atmosphereColor="#5fc9c2"
        atmosphereAltitude={0.18}
        hexPolygonsData={countries}
        hexPolygonResolution={H3_RESOLUTION}
        hexPolygonMargin={0.3}
        hexPolygonColor={hexColor}
        hexPolygonAltitude={0.01}
      />
    </div>
  )
}

export default App
