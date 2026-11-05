import { useEffect, useMemo, useRef, useState } from 'react'
import { geoAlbersUsa, geoPath, select, zoom, zoomIdentity, type GeoPath, type GeoPermissibleObjects } from 'd3'
import { feature } from 'topojson-client'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'

const WIDTH = 1280
// Unlike geoNaturalEarth1 (used for the world map), geoAlbersUsa has no
// universal "Sphere" shape to fit — it's a composite projection limited to
// exactly the 50 states, built from fitting to the actual state collection.
// 749 is the natural aspect ratio that comes out of that fit (measured the
// same way as the world map's own MAP_ASPECT_RATIO), so this box also
// touches its content on all four sides with ~0 leftover padding.
const HEIGHT = 749
export const MAP_ASPECT_RATIO = `${WIDTH} / ${HEIGHT}`

const OCEAN_COLOR = '#0b1f2e'
const LAND_COLOR = '#143347'
const BORDER_COLOR = 'rgba(227, 236, 233, 0.25)'

export interface StateProperties {
  name: string
}
export type StateFeature = Feature<Polygon | MultiPolygon, StateProperties>

// geoAlbersUsa only knows how to project the 50 states (it has no insets for
// anything else) — these five are real US-atlas entries but project to
// invalid/NaN coordinates under it, so they're excluded before anything
// else touches the data rather than rendered broken.
const UNPROJECTABLE_TERRITORIES = new Set([
  'Puerto Rico',
  'Guam',
  'American Samoa',
  'Commonwealth of the Northern Mariana Islands',
  'United States Virgin Islands',
])

interface USMap2DProps {
  // Fired once, the first time the state data finishes loading — same shape
  // as WorldMap2D's onCountriesLoaded, for a future US click-quiz to build
  // its own guessable pool from (DC is included here; whether it counts as
  // a guessable "state" is a quiz-logic decision, not a map one).
  onStatesLoaded?: (states: StateFeature[]) => void
  onStateClick?: (name: string) => void
  stateFill?: (name: string) => string | undefined
}

// A US states equivalent of WorldMap2D, built separately rather than
// forcing both through one shared component — the projection setup
// genuinely differs (see HEIGHT above), and with only two real examples so
// far, it's more honest to see what they actually share before abstracting
// it, rather than guessing at a generic "2D region map" shape from one.
function USMap2D({ onStatesLoaded, onStateClick, stateFill }: USMap2DProps) {
  const [states, setStates] = useState<StateFeature[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const groupRef = useRef<SVGGElement>(null)
  const onStatesLoadedRef = useRef(onStatesLoaded)
  onStatesLoadedRef.current = onStatesLoaded

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/us-states.json`)
      .then((res) => res.json())
      .then((topology: Topology) => {
        if (cancelled) return
        const collection = feature(topology, topology.objects.states as GeometryCollection)
        const loaded = (collection.features as StateFeature[]).filter(
          (f) => !UNPROJECTABLE_TERRITORIES.has(f.properties.name),
        )
        setStates(loaded)
        onStatesLoadedRef.current?.(loaded)
      })
      .catch(() => {
        // Prototype route — a failed fetch just leaves the map empty, same
        // as WorldMap2D.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Computed once states load, not on every render — fitSize needs the
  // actual data (see the HEIGHT comment above), but still only needs to run
  // once, the same way the world map's projection only needs to be built
  // once (there it just happens to not need the data at all). Unlike the
  // world map, there's no "Sphere" background shape to fill here — AlbersUsa
  // is a bounded composite projection of just the 50 states, not a
  // spherical one, so the SVG's own CSS background covers the ocean.
  const path = useMemo<GeoPath<unknown, GeoPermissibleObjects> | null>(() => {
    if (states.length === 0) return null
    const projection = geoAlbersUsa().fitSize([WIDTH, HEIGHT], { type: 'FeatureCollection', features: states })
    return geoPath(projection)
  }, [states])

  // Wheel to zoom, drag to pan, bounded to the map's own extent — identical
  // behavior/reasoning to WorldMap2D's zoom setup.
  useEffect(() => {
    const svg = svgRef.current
    const group = groupRef.current
    if (!svg || !group) return
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [WIDTH, HEIGHT]])
      .extent([[0, 0], [WIDTH, HEIGHT]])
      .on('zoom', (event) => {
        group.setAttribute('transform', event.transform.toString())
      })
    select(svg).call(behavior)
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: '100%', height: '100%', background: OCEAN_COLOR, cursor: 'grab', display: 'block' }}
    >
      <g ref={groupRef} transform={zoomIdentity.toString()}>
        {path &&
          states.map((state) => {
            const name = state.properties.name
            return (
              <path
                key={name}
                data-state={name}
                d={path(state) ?? undefined}
                fill={stateFill?.(name) ?? LAND_COLOR}
                stroke={BORDER_COLOR}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                onClick={onStateClick ? () => onStateClick(name) : undefined}
                style={onStateClick ? { cursor: 'pointer' } : undefined}
              />
            )
          })}
      </g>
    </svg>
  )
}

export default USMap2D
