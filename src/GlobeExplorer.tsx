import { useEffect, useMemo, useRef, useState } from 'react'
import { geoBounds, geoCentroid } from 'd3'
import { Link } from 'react-router-dom'
import { Color } from 'three'
import { CONTINENT_BY_COUNTRY } from './continents'
import CountryPicker from './CountryPicker'
import { LAND_COLOR, useWorldGlobe, type CountryFeature } from './useWorldGlobe'

const SELECTED_COLOR = new Color('#f2b134')

const DEFAULT_FLY_ALTITUDE = 1.4
const MIN_FLY_ALTITUDE = 0.01
// Tuned so a France-sized country (~1000km across) lands at roughly the
// previous fixed altitude, while a country the size of Vatican City (a few
// hundred meters) gets clamped to MIN_FLY_ALTITUDE instead of an altitude so
// large the country is sub-pixel — at a fixed 1.4 for every country
// regardless of size, tiny nations were indistinguishable from whatever
// larger country surrounds them.
const FLY_ALTITUDE_SCALE_KM = 700

function altitudeForCountry(country: CountryFeature): number {
  const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(country)
  const avgLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180)
  const widthKm = (maxLng - minLng) * 111 * Math.cos(avgLatRad)
  const heightKm = (maxLat - minLat) * 111
  const diagonalKm = Math.hypot(widthKm, heightKm)
  return Math.min(DEFAULT_FLY_ALTITUDE, Math.max(MIN_FLY_ALTITUDE, diagonalKm / FLY_ALTITUDE_SCALE_KM))
}

function GlobeExplorer() {
  const { containerRef, globeRef, countries, paintCountry } = useWorldGlobe()
  const [selectedName, setSelectedName] = useState('')
  const previousSelectedRef = useRef('')

  // Antarctica is part of `countries` (so it still renders on the globe) but
  // isn't in CONTINENT_BY_COUNTRY, so it's excluded here — it's shown on the
  // map but isn't a selectable country.
  const countryByName = useMemo(
    () => new Map(countries.filter((c) => c.properties.NAME in CONTINENT_BY_COUNTRY).map((c) => [c.properties.NAME, c])),
    [countries],
  )
  const countryNames = useMemo(
    () => [...countryByName.keys()].sort((a, b) => a.localeCompare(b)),
    [countryByName],
  )
  const countryNamesByContinent = useMemo(() => {
    const groups = new Map<string, string[]>()
    for (const name of countryNames) {
      const continent = CONTINENT_BY_COUNTRY[name]
      const list = groups.get(continent) ?? []
      list.push(name)
      groups.set(continent, list)
    }
    return groups
  }, [countryNames])

  useEffect(() => {
    if (previousSelectedRef.current) paintCountry(previousSelectedRef.current, LAND_COLOR)
    if (selectedName) paintCountry(selectedName, SELECTED_COLOR)
    previousSelectedRef.current = selectedName
  }, [selectedName, countries, paintCountry])

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
    globe.pointOfView({ lat, lng, altitude: altitudeForCountry(country) }, 1200)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <CountryPicker
        countryNamesByContinent={countryNamesByContinent}
        selectedName={selectedName}
        onSelect={flyToCountry}
      />
      <Link
        to="/quiz"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1,
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(10, 19, 18, 0.85)',
          color: '#e3ece9',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
          textDecoration: 'none',
        }}
      >
        Play World Quiz
      </Link>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default GlobeExplorer
