import { useEffect, useRef, useState } from 'react'
import { geoNaturalEarth1, geoPath, select, zoom, zoomIdentity } from 'd3'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { CountryFeature } from './useWorldGlobe'

const WIDTH = 1280
// geoNaturalEarth1's projected sphere outline isn't 16:9 — it's ~1.923:1
// (measured via fitSize into a large square and reading back the bounds).
// Matching the box's own aspect ratio to that exactly, instead of an
// arbitrary 16:9, is what makes fitSize touch all four edges with zero
// leftover letterboxing — exported as MAP_ASPECT_RATIO so any page placing
// this in a box can match it.
const HEIGHT = 666
export const MAP_ASPECT_RATIO = `${WIDTH} / ${HEIGHT}`

// Same ocean/land colors as EmptyGlobe's blank state, so a plain (no-props)
// render of this still reads as the same "blank slate" concept.
const OCEAN_COLOR = '#0b1f2e'
const LAND_COLOR = '#143347'
const BORDER_COLOR = 'rgba(227, 236, 233, 0.25)'

// Projection/path only depend on WIDTH/HEIGHT, which never change, so build
// them once at module scope instead of on every render — recomputing a
// geoPath for ~177 countries on every zoom/pan tick is what was causing lag.
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' })
const path = geoPath(projection)
const SPHERE_PATH = path({ type: 'Sphere' }) ?? undefined

interface WorldMap2DProps {
  // Fired once, the first time the country data finishes loading — lets a
  // caller (e.g. a click-quiz) build its own guessable-names pool without
  // this component needing to know anything about quiz logic itself.
  onCountriesLoaded?: (countries: CountryFeature[]) => void
  onCountryClick?: (name: string) => void
  // Per-country fill override. Falls back to the default LAND_COLOR for any
  // name it doesn't return a color for (or when the prop itself is omitted).
  countryFill?: (name: string) => string | undefined
}

// Fills whatever box its parent gives it, at the fixed WIDTH:HEIGHT ratio
// above (the box should match MAP_ASPECT_RATIO, or the SVG will letterbox
// inside it). With no props this is just a static blank map, same as
// before; onCountryClick/countryFill are what turn it into something
// interactive (e.g. ClickQuiz) without duplicating the projection/zoom/pan
// plumbing in a second component.
function WorldMap2D({ onCountriesLoaded, onCountryClick, countryFill }: WorldMap2DProps) {
  const [countries, setCountries] = useState<CountryFeature[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const groupRef = useRef<SVGGElement>(null)
  const onCountriesLoadedRef = useRef(onCountriesLoaded)
  onCountriesLoadedRef.current = onCountriesLoaded

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/countries.json`)
      .then((res) => res.json())
      .then((topology: Topology) => {
        if (cancelled) return
        const collection = feature(topology, topology.objects.countries as GeometryCollection)
        const loaded = collection.features as CountryFeature[]
        setCountries(loaded)
        onCountriesLoadedRef.current?.(loaded)
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
        {countries.map((country) => {
          const name = country.properties.NAME
          return (
            <path
              key={name}
              data-country={name}
              d={path(country) ?? undefined}
              fill={countryFill?.(name) ?? LAND_COLOR}
              stroke={BORDER_COLOR}
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
              onClick={onCountryClick ? () => onCountryClick(name) : undefined}
              style={onCountryClick ? { cursor: 'pointer' } : undefined}
            />
          )
        })}
      </g>
    </svg>
  )
}

export default WorldMap2D
