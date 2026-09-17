import { useEffect, useMemo, useRef, useState } from 'react'
import { geoArea, geoBounds, geoCentroid } from 'd3'
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import Globe, { type GlobeInstance } from 'globe.gl'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { BufferAttribute, Color, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshPhongMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import ConicPolygonGeometry from 'three-conic-polygon-geometry'
import GeoJsonGeometry from 'three-geojson-geometry'

interface CountryProperties {
  NAME: string
}

type CountryFeature = Feature<Polygon | MultiPolygon, CountryProperties>

interface VertexRange {
  start: number
  count: number
}

const OCEAN_MATERIAL = new MeshPhongMaterial({ color: '#0b1f2e' })
const LAND_COLOR = new Color('#3fae8f')
const SELECTED_COLOR = new Color('#f2b134')
const BORDER_MATERIAL = new LineBasicMaterial({ color: '#173330' })
const POLYGON_ALTITUDE = 0.006

function ringsOf(geometry: Polygon | MultiPolygon): Position[][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

const EARTH_RADIUS_KM = 6371
const FINE_CURVATURE_AREA_KM2 = 2000

function curvatureResolutionFor(ring: Position[][]): number {
  const areaKm2 = geoArea({ type: 'Polygon', coordinates: ring }) * EARTH_RADIUS_KM * EARTH_RADIUS_KM
  return areaKm2 < FINE_CURVATURE_AREA_KM2 ? 1 : 5
}

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

// Builds one merged land mesh plus one merged border-line object for all
// countries, instead of three-globe's default of a separate mesh, material
// and line object per island ring. With ~350 countries exploding into over a
// thousand disconnected pieces (every skerry off Norway, every atoll of
// Indonesia), that default meant thousands of draw calls and thousands of
// near-identical materials for a map that's visually just two colors —
// enough to tank frame rate to a fraction of a frame per second.
//
// The land mesh carries a per-vertex color attribute (all initialized to
// LAND_COLOR) instead of a flat material color, and returns the vertex range
// each country occupies within it. Selecting a country repaints just that
// range in place — deliberately not a second mesh layered on top: an
// existing attempt at that (even at a near-zero altitude offset meant only
// to dodge z-fighting) still z-fought visibly with the base layer, since two
// separately-triangulated copies of the same coastline are never quite
// coplanar edge-for-edge.
//
// Small islands get a finer curvatureResolution than large landmasses (see
// FINE_CURVATURE_AREA_KM2 below) — ConicPolygonGeometry's cap triangulation
// interpolates the ring boundary into a contour at a fixed angular step
// before triangulating it, so a coarse step is proportionally coarser on a
// small, high-curvature island than on a landmass the size of France.
function buildWorldLayer(
  countries: CountryFeature[],
  radius: number,
): { group: Group; colorAttribute: BufferAttribute; rangesByName: Map<string, VertexRange> } {
  const topRadius = radius * (1 + POLYGON_ALTITUDE)
  // Only a hair above the cap — enough to avoid z-fighting, but small enough
  // that at close/oblique zoom the border doesn't visibly part ways from the
  // coastline beneath it (a larger gap here reads as parallax: the border,
  // sitting measurably higher than the land, appears to drift sideways off
  // the actual edge the closer and more obliquely you look at it).
  const borderRadius = radius * (1 + POLYGON_ALTITUDE + 0.00002)

  const capGeometries = []
  const borderGeometries = []
  const rangesByName = new Map<string, VertexRange>()
  let vertexCursor = 0
  for (const country of countries) {
    const start = vertexCursor
    for (const ring of ringsOf(country.geometry)) {
      const res = curvatureResolutionFor(ring)
      const cap = new ConicPolygonGeometry(ring, 0, topRadius, false, true, false, res)
      vertexCursor += cap.attributes.position.count
      capGeometries.push(cap)
      borderGeometries.push(new GeoJsonGeometry({ type: 'Polygon', coordinates: ring }, borderRadius, res))
    }
    rangesByName.set(country.properties.NAME, { start, count: vertexCursor - start })
  }

  const capGeometry = mergeGeometries(capGeometries, false)
  const colors = new Float32Array(capGeometry.attributes.position.count * 3)
  const colorAttribute = new BufferAttribute(colors, 3)
  for (let i = 0; i < colorAttribute.count; i++) {
    colorAttribute.setXYZ(i, LAND_COLOR.r, LAND_COLOR.g, LAND_COLOR.b)
  }
  capGeometry.setAttribute('color', colorAttribute)

  const group = new Group()
  group.add(new Mesh(capGeometry, new MeshBasicMaterial({ vertexColors: true })))
  group.add(new LineSegments(mergeGeometries(borderGeometries, false), BORDER_MATERIAL))
  return { group, colorAttribute, rangesByName }
}

function paintRange(colorAttribute: BufferAttribute, range: VertexRange | undefined, color: Color): void {
  if (!range) return
  for (let v = range.start; v < range.start + range.count; v++) {
    colorAttribute.setXYZ(v, color.r, color.g, color.b)
  }
  colorAttribute.needsUpdate = true
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const worldGroupRef = useRef<Group | null>(null)
  const worldLayerRef = useRef<{ colorAttribute: BufferAttribute; rangesByName: Map<string, VertexRange> } | null>(
    null,
  )
  const selectedRangeRef = useRef<VertexRange | undefined>(undefined)
  const [countries, setCountries] = useState<CountryFeature[]>([])
  const [selectedName, setSelectedName] = useState('')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/countries.json`)
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

    const { group, colorAttribute, rangesByName } = buildWorldLayer(countries, globe.getGlobeRadius())
    worldGroup.add(group)
    worldLayerRef.current = { colorAttribute, rangesByName }
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
    const worldLayer = worldLayerRef.current
    if (!worldLayer) return
    const { colorAttribute, rangesByName } = worldLayer

    paintRange(colorAttribute, selectedRangeRef.current, LAND_COLOR)
    const nextRange = rangesByName.get(selectedName)
    paintRange(colorAttribute, nextRange, SELECTED_COLOR)
    selectedRangeRef.current = nextRange
  }, [selectedName, countries])

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
