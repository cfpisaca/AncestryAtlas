import { useCallback, useEffect, useRef, useState } from 'react'
import { geoArea } from 'd3'
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

    const { group, colorAttribute, rangesByName } = buildWorldLayer(countries, globe.getGlobeRadius())
    worldGroup.add(group)
    worldLayerRef.current = { colorAttribute, rangesByName }
  }, [countries])

  const paintCountry = useCallback((name: string, color: Color) => {
    const layer = worldLayerRef.current
    if (!layer) return
    paintRange(layer.colorAttribute, layer.rangesByName.get(name), color)
  }, [])

  const isLoading = countries.length === 0 && !loadError

  return { containerRef, globeRef, countries, paintCountry, isLoading, loadError, retry }
}
