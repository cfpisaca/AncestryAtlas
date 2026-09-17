import { useEffect, useMemo, useRef, useState } from 'react'
import { geoArea, geoCentroid } from 'd3'
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import Globe, { type GlobeInstance } from 'globe.gl'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshPhongMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import ConicPolygonGeometry from 'three-conic-polygon-geometry'
import GeoJsonGeometry from 'three-geojson-geometry'

interface CountryProperties {
  NAME: string
}

type CountryFeature = Feature<Polygon | MultiPolygon, CountryProperties>

const OCEAN_MATERIAL = new MeshPhongMaterial({ color: '#0b1f2e' })
const LAND_MATERIAL = new MeshBasicMaterial({ color: '#3fae8f' })
const BORDER_MATERIAL = new LineBasicMaterial({ color: '#173330' })
const SELECTED_MATERIAL = new MeshBasicMaterial({ color: '#f2b134' })
const SELECTED_SIDE_MATERIAL = new MeshBasicMaterial({ color: '#040a09', transparent: true, opacity: 0.35 })
const SELECTED_BORDER_MATERIAL = new LineBasicMaterial({ color: '#173330' })
const POLYGON_ALTITUDE = 0.006
const HIGHLIGHT_ALTITUDE = POLYGON_ALTITUDE + 0.002 // sits just above the base land layer so it isn't z-fought

function ringsOf(geometry: Polygon | MultiPolygon): Position[][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

const EARTH_RADIUS_KM = 6371
const FINE_CURVATURE_AREA_KM2 = 2000

function curvatureResolutionFor(ring: Position[][]): number {
  const areaKm2 = geoArea({ type: 'Polygon', coordinates: ring }) * EARTH_RADIUS_KM * EARTH_RADIUS_KM
  return areaKm2 < FINE_CURVATURE_AREA_KM2 ? 1 : 5
}

// Builds one merged land mesh plus one merged border-line object for the
// given countries, instead of three-globe's default of a separate mesh,
// material and line object per island ring. With ~350 countries exploding
// into over a thousand disconnected pieces (every skerry off Norway, every
// atoll of Indonesia), that default meant thousands of draw calls and
// thousands of near-identical materials for a map that's visually just two
// colors — enough to tank frame rate to a fraction of a frame per second.
//
// This is also used for the single selected-country highlight, not just the
// full-world base layer, so both are built through the exact same code path
// (guaranteeing the highlight's shape exactly matches the base layer's,
// rather than risking two independent triangulations of the same ring
// drifting apart from each other).
//
// Small islands get a finer curvatureResolution than large landmasses (see
// FINE_CURVATURE_AREA_KM2 below) — ConicPolygonGeometry's cap triangulation
// interpolates the ring boundary into a contour at a fixed angular step
// before triangulating it, so a coarse step is proportionally coarser on a
// small, high-curvature island than on a landmass the size of France. Known
// remaining issue: at extreme close zoom (well beyond normal use), a small
// number of complex coastal stretches can still show a thin sliver of the
// base layer's color along part of a selected country's edge. Investigated
// without a confirmed root cause — ruled out the border's altitude offset,
// this curvatureResolution split, self-intersecting source geometry (fixed
// separately either way, see build-countries-data.mjs's `-clean` step), and
// ocean lighting.
function buildCountryLayer(
  countries: CountryFeature[],
  radius: number,
  altitude: number,
  capMaterial: MeshBasicMaterial,
  borderMaterial: LineBasicMaterial,
  sideMaterial?: MeshBasicMaterial,
): Group {
  const topRadius = radius * (1 + altitude)
  // Only a hair above the cap — enough to avoid z-fighting, but small enough
  // that at close/oblique zoom the border doesn't visibly part ways from the
  // coastline beneath it (a larger gap here reads as parallax: the border,
  // sitting measurably higher than the land, appears to drift sideways off
  // the actual edge the closer and more obliquely you look at it).
  const borderRadius = radius * (1 + altitude + 0.00002)

  // Cap and side geometry are built as fully separate meshes rather than one
  // multi-material mesh: mergeGeometries(..., useGroups: false) — needed so
  // every ring collapses into a single draw call instead of one per input —
  // discards each ConicPolygonGeometry's own cap/side material groups, so a
  // merged multi-material mesh would silently render every ring with just
  // one of the two materials.
  const capGeometries = []
  const sideGeometries = []
  const borderGeometries = []
  for (const country of countries) {
    for (const ring of ringsOf(country.geometry)) {
      const res = curvatureResolutionFor(ring)
      capGeometries.push(new ConicPolygonGeometry(ring, 0, topRadius, false, true, false, res))
      if (sideMaterial) sideGeometries.push(new ConicPolygonGeometry(ring, 0, topRadius, false, false, true, res))
      borderGeometries.push(new GeoJsonGeometry({ type: 'Polygon', coordinates: ring }, borderRadius, res))
    }
  }

  const group = new Group()
  group.add(new Mesh(mergeGeometries(capGeometries, false), capMaterial))
  if (sideMaterial) group.add(new Mesh(mergeGeometries(sideGeometries, false), sideMaterial))
  group.add(new LineSegments(mergeGeometries(borderGeometries, false), borderMaterial))
  return group
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const worldGroupRef = useRef<Group | null>(null)
  const highlightRef = useRef<Group | null>(null)
  const [countries, setCountries] = useState<CountryFeature[]>([])
  const [selectedName, setSelectedName] = useState('')

  useEffect(() => {
    fetch('/data/countries.json')
      .then((res) => res.json())
      .then((topology: Topology) => {
        const collection = feature(topology, topology.objects.countries as GeometryCollection)
        const withGeometry = collection.features.filter((f) => f.geometry) as CountryFeature[]
        setCountries(withGeometry)
      })
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const worldGroup = new Group()
    worldGroupRef.current = worldGroup

    const globe = new Globe(container)
      .width(container.clientWidth)
      .height(container.clientHeight)
      .globeMaterial(OCEAN_MATERIAL)
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('#5fc9c2')
      .atmosphereAltitude(0.18)
      .customLayerData([{}])
      .customThreeObject(() => worldGroup)

    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.2 })
    globe.controls().autoRotate = true
    globe.controls().autoRotateSpeed = 0.4

    globeRef.current = globe

    const handleResize = () => {
      globe.width(container.clientWidth).height(container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      globe._destructor()
      globeRef.current = null
    }
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    const worldGroup = worldGroupRef.current
    if (!globe || !worldGroup || countries.length === 0) return

    const baseLayer = buildCountryLayer(countries, globe.getGlobeRadius(), POLYGON_ALTITUDE, LAND_MATERIAL, BORDER_MATERIAL)
    worldGroup.add(baseLayer)
  }, [countries])

  const countryByName = useMemo(
    () => new Map(countries.map((country) => [country.properties.NAME, country])),
    [countries],
  )
  const countryNames = useMemo(
    () => [...countryByName.keys()].sort((a, b) => a.localeCompare(b)),
    [countryByName],
  )

  useEffect(() => {
    const globe = globeRef.current
    const worldGroup = worldGroupRef.current
    if (!globe || !worldGroup) return

    if (highlightRef.current) {
      worldGroup.remove(highlightRef.current)
      highlightRef.current = null
    }

    const country = countryByName.get(selectedName)
    if (!country) return

    const highlight = buildCountryLayer(
      [country],
      globe.getGlobeRadius(),
      HIGHLIGHT_ALTITUDE,
      SELECTED_MATERIAL,
      SELECTED_BORDER_MATERIAL,
      SELECTED_SIDE_MATERIAL,
    )
    worldGroup.add(highlight)
    highlightRef.current = highlight
  }, [selectedName, countryByName])

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

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
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
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default App
