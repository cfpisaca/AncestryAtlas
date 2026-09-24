import { useCallback, useEffect, useRef, useState } from 'react'
import { geoArea, geoBounds } from 'd3'
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import Globe, { type GlobeInstance } from 'globe.gl'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { BufferAttribute, Color, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshPhongMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import ConicPolygonGeometry from 'three-conic-polygon-geometry'
import GeoJsonGeometry from 'three-geojson-geometry'

export interface CountryProperties {
  NAME: string
}

export type CountryFeature = Feature<Polygon | MultiPolygon, CountryProperties>

interface VertexRange {
  start: number
  count: number
}

const OCEAN_MATERIAL = new MeshPhongMaterial({ color: '#0b1f2e' })
export const LAND_COLOR = new Color('#3fae8f')
const BORDER_MATERIAL = new LineBasicMaterial({ color: '#173330' })
const POLYGON_ALTITUDE = 0.006
// Gold, matching the missing-country hint dots — the map-ring highlight.
// The sidebar's own most-recent-guess outline is a separate, unrelated
// color (green, set in WorldQuiz.tsx) rather than reusing this one.
export const HIGHLIGHT_COLOR = '#fbbf24'
const HIGHLIGHT_MATERIAL = new LineBasicMaterial({ color: HIGHLIGHT_COLOR })

const DEFAULT_FLY_ALTITUDE = 1.4
const MIN_FLY_ALTITUDE = 0.01
// Tuned so a France-sized country (~1000km across) lands at roughly the
// previous fixed altitude, while a country the size of Vatican City (a few
// hundred meters) gets clamped to MIN_FLY_ALTITUDE instead of an altitude so
// large the country is sub-pixel — at a fixed 1.4 for every country
// regardless of size, tiny nations were indistinguishable from whatever
// larger country surrounds them.
const FLY_ALTITUDE_SCALE_KM = 700

// Shared by every mode that flies the camera to a country (the explorer's
// picker, the quiz's guess-and-jump), so the same size-aware zoom applies
// everywhere instead of each caller picking its own fixed altitude.
export function altitudeForCountry(country: CountryFeature): number {
  const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(country)
  const avgLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180)
  const widthKm = (maxLng - minLng) * 111 * Math.cos(avgLatRad)
  const heightKm = (maxLat - minLat) * 111
  const diagonalKm = Math.hypot(widthKm, heightKm)
  return Math.min(DEFAULT_FLY_ALTITUDE, Math.max(MIN_FLY_ALTITUDE, diagonalKm / FLY_ALTITUDE_SCALE_KM))
}

function ringsOf(geometry: Polygon | MultiPolygon): Position[][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

const EARTH_RADIUS_KM = 6371
const FINE_CURVATURE_AREA_KM2 = 2000

function curvatureResolutionFor(ring: Position[][]): number {
  const areaKm2 = geoArea({ type: 'Polygon', coordinates: ring }) * EARTH_RADIUS_KM * EARTH_RADIUS_KM
  return areaKm2 < FINE_CURVATURE_AREA_KM2 ? 1 : 5
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
// each country occupies within it, so any mode (the explorer's single
// highlight, the quiz's many simultaneous guesses) can repaint just the
// countries it cares about in place — deliberately not a second mesh
// layered on top: an existing attempt at that (even at a near-zero altitude
// offset meant only to dodge z-fighting) still z-fought visibly with the
// base layer, since two separately-triangulated copies of the same
// coastline are never quite coplanar edge-for-edge.
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

// Shared globe setup for every mode (the free-explore picker, the world
// quiz, and future gamemodes): fetches the country data once, mounts a
// globe.gl instance into whatever container the caller renders, builds the
// merged world mesh, and exposes paintCountry so each mode can recolor
// countries however its own game logic needs without knowing anything about
// the underlying mesh/vertex-range plumbing.
export function useWorldGlobe({ autoRotate = true }: { autoRotate?: boolean } = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const worldGroupRef = useRef<Group | null>(null)
  const worldLayerRef = useRef<{ colorAttribute: BufferAttribute; rangesByName: Map<string, VertexRange> } | null>(
    null,
  )
  const [countries, setCountries] = useState<CountryFeature[]>([])
  // Tracks the land mesh itself, not just the fetch: buildWorldLayer merges
  // geometry for ~250 countries synchronously and can take noticeably
  // longer than the fetch, so isLoading below stays true through that work
  // too — otherwise the loading overlay disappears the instant the JSON
  // arrives, and whoever's looking at it sees the loading text vanish, then
  // a bare ocean sphere for however long the merge takes, before land pops
  // in — reading as broken rather than still loading.
  const [worldReady, setWorldReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  // Read via ref inside the mount effect below (deps []) rather than as a
  // direct dependency: it's a one-time initial value for the globe, not
  // something that should tear down and rebuild the globe if a caller's
  // prop happens to change on a later render.
  const initialAutoRotateRef = useRef(autoRotate)

  // Without a .catch() here, a failed or dropped fetch (slow connection,
  // GitHub Pages hiccup) left the globe an unexplained blank dark sphere
  // forever — no error, no loading indication, indistinguishable from
  // "still loading" to whoever's looking at it.
  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/countries.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load world data (HTTP ${res.status})`)
        return res.json()
      })
      .then((topology: Topology) => {
        if (cancelled) return
        const collection = feature(topology, topology.objects.countries as GeometryCollection)
        const withGeometry = collection.features.filter((f) => f.geometry) as CountryFeature[]
        setCountries(withGeometry)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load world data')
      })
    return () => {
      cancelled = true
    }
  }, [retryToken])

  const retry = useCallback(() => {
    setLoadError(null)
    setWorldReady(false)
    setCountries([])
    setRetryToken((t) => t + 1)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const worldGroup = new Group()
    worldGroupRef.current = worldGroup

    // WebGL's default depth buffer spends most of its precision close to the
    // camera, so the ~38km gap between land's cap and the ocean sphere below
    // it (POLYGON_ALTITUDE) becomes unresolvable at long camera distances —
    // the two surfaces flicker against each other, worse zoomed out than in,
    // and worse on mobile GPUs (often a 16-bit depth buffer vs. 24-bit on
    // desktop). A logarithmic depth buffer fixes the precision distribution
    // itself instead of trying to widen the gap further.
    const globe = new Globe(container, { rendererConfig: { logarithmicDepthBuffer: true } })
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
    globe.controls().autoRotate = initialAutoRotateRef.current
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

    // Without this try/catch, a failure here (e.g. mergeGeometries choking
    // on a country whose rings produced inconsistent vertex attributes)
    // left the globe rendering fine — atmosphere, ocean, stars all present —
    // just with no land ever added, and nothing to distinguish that from
    // still loading: isLoading is already false once countries is populated,
    // so the failure was as invisible as the unguarded fetch this same
    // pattern already fixes above.
    try {
      const { group, colorAttribute, rangesByName } = buildWorldLayer(countries, globe.getGlobeRadius())
      worldGroup.add(group)
      worldLayerRef.current = { colorAttribute, rangesByName }
      setWorldReady(true)
      // Only relevant on retry (a second successful fetch after a first
      // failure): removes the previous mesh instead of leaving it layered
      // underneath a newly-built one.
      return () => {
        worldGroup.remove(group)
        worldLayerRef.current = null
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to render world data')
    }
  }, [countries])

  const paintCountry = useCallback((name: string, color: Color) => {
    const layer = worldLayerRef.current
    if (!layer) return
    paintRange(layer.colorAttribute, layer.rangesByName.get(name), color)
  }, [])

  const highlightRef = useRef<LineSegments | null>(null)

  // Draws a bright ring around one country's actual coastline, on top of
  // both the land cap and the ordinary border layer — used to call out
  // e.g. "the country you just guessed" distinctly from a same-colored fill
  // alone. Passing null clears it. Only ever one highlight at a time: the
  // previous ring is removed before (or instead of) adding a new one.
  const highlightCountry = useCallback((country: CountryFeature | null) => {
    const worldGroup = worldGroupRef.current
    const globe = globeRef.current
    if (!worldGroup) return
    if (highlightRef.current) {
      worldGroup.remove(highlightRef.current)
      highlightRef.current = null
    }
    if (!country || !globe) return
    const radius = globe.getGlobeRadius()
    const highlightRadius = radius * (1 + POLYGON_ALTITUDE + 0.0006)
    const geometries = ringsOf(country.geometry).map(
      (ring) => new GeoJsonGeometry({ type: 'Polygon', coordinates: ring }, highlightRadius, curvatureResolutionFor(ring)),
    )
    const line = new LineSegments(mergeGeometries(geometries, false), HIGHLIGHT_MATERIAL)
    worldGroup.add(line)
    highlightRef.current = line
  }, [])

  const isLoading = !worldReady && !loadError

  return { containerRef, globeRef, countries, paintCountry, highlightCountry, isLoading, loadError, retry }
}
