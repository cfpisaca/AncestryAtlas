import { useEffect, useRef, useState } from 'react'
import { geoNaturalEarth1, geoPath, select, zoom, zoomIdentity } from 'd3'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { CountryFeature } from './useWorldGlobe'

const WIDTH = 1280
const HEIGHT = 720

// Same ocean/land colors as EmptyGlobe's blank state, so both prototypes
// read as the same visual "blank slate" concept, just flat vs. 3D.
const OCEAN_COLOR = '#0b1f2e'
const LAND_COLOR = '#143347'
const BORDER_COLOR = 'rgba(227, 236, 233, 0.25)'

// Projection/path only depend on WIDTH/HEIGHT, which never change, so build
// them once at module scope instead of on every render — recomputing a
// geoPath for ~177 countries on every zoom/pan tick is what was causing lag.
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' })
const path = geoPath(projection)
const SPHERE_PATH = path({ type: 'Sphere' }) ?? undefined

// Fills whatever box its parent gives it — BlankMapPrototype owns the page
// chrome (back link, mode toggle, the bounded box itself) so this and
// EmptyGlobe can be swapped inside it.
function EmptyMap2D() {
  const [countries, setCountries] = useState<CountryFeature[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const groupRef = useRef<SVGGElement>(null)

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

  // Wheel to zoom, drag to pan — mirrors the 3D globe's built-in orbit
  // controls so the two prototypes are a fair comparison. Scale is capped
  // at 1x min (can't zoom out past the default fit) and 8x max.
  //
  // translateExtent + extent both set to the map's own [0,0]-[WIDTH,HEIGHT]
  // bounds clamps panning the same way e.g. Google Maps does: the content
  // can never be dragged far enough to show empty space past its edges, so
  // it can't be panned out of the box it's sitting in.
  //
  // The transform is applied straight to the <g> DOM node instead of going
  // through React state, so dragging/zooming never triggers a re-render —
  // that was the other source of lag (177 path elements re-rendering per tick).
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
        <path d={SPHERE_PATH} fill={OCEAN_COLOR} />
        {countries.map((country) => (
          <path
            key={country.properties.NAME}
            d={path(country) ?? undefined}
            fill={LAND_COLOR}
            stroke={BORDER_COLOR}
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  )
}

export default EmptyMap2D
