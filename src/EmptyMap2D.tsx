import { useEffect, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { Link } from 'react-router-dom'
import type { CountryFeature } from './useWorldGlobe'

const WIDTH = 1280
const HEIGHT = 720

// Same ocean/land colors as EmptyGlobe's blank state, so both prototypes
// read as the same visual "blank slate" concept, just flat vs. 3D.
const OCEAN_COLOR = '#0b1f2e'
const LAND_COLOR = '#143347'
const BORDER_COLOR = 'rgba(227, 236, 233, 0.25)'

function EmptyMap2D() {
  const [countries, setCountries] = useState<CountryFeature[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/countries.json`)
      .then((res) => res.json())
      .then((topology: Topology) => {
        if (cancelled) return
        const collection = feature(topology, topology.objects.countries as GeometryCollection)
        setCountries(collection.features as CountryFeature[])
      })
      .catch(() => {
        // Prototype route — a failed fetch just leaves the map empty,
        // no retry/error UI needed yet the way the real quiz modes have.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' })
  const path = geoPath(projection)

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: OCEAN_COLOR }}>
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
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: '100%' }}>
        <path d={path({ type: 'Sphere' }) ?? undefined} fill={OCEAN_COLOR} />
        {countries.map((country) => (
          <path
            key={country.properties.NAME}
            d={path(country) ?? undefined}
            fill={LAND_COLOR}
            stroke={BORDER_COLOR}
            strokeWidth={0.5}
          />
        ))}
      </svg>
    </div>
  )
}

export default EmptyMap2D
