#!/usr/bin/env node
// Regenerates public/data/countries.json from the raw source in
// data/sources/country-boundaries-raw.topojson. Run with: npm run data:countries
//
// That source file is Natural Earth's 1:10m "admin-0 map subunits" dataset —
// the most granular of their country-boundary layers, which is why it's
// used instead of their plainer "countries" file: it keeps disputed and
// leased territories (Crimea, Baikonur, etc. — see part 1 below) as their
// own separate pieces instead of silently folding them into whoever
// administers them, so this script can decide how to resolve them instead
// of inheriting someone else's default.
//
// To refresh it from upstream Natural Earth:
//   curl -L -o /tmp/ne_subunits.geojson \
//     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_subunits.geojson
//   npx -p mapshaper mapshaper /tmp/ne_subunits.geojson \
//     -filter-fields NAME \
//     -o format=topojson quantization=1e5 data/sources/country-boundaries-raw.topojson
//
// This ships real vector country shapes (not a hex approximation) — the app
// renders them directly as filled GeoJSON polygons. Four things are done to
// the raw source before it's usable:
//
// 1. Resolving disputed-sovereignty subunits to the US-recognized country.
//    Natural Earth ships a handful of contested territories as their own
//    named subunits, attributed by whoever administers them rather than by
//    recognized sovereignty — e.g. Crimea is attributed to Russia, even
//    though the US doesn't recognize the annexation and still considers it
//    Ukrainian territory. Left as-is, each one renders as its own outlined
//    shape, which on screen just looks like a stray border seam slicing
//    through the country next door for no visible reason (this is what the
//    line through Russia and the circle in Kazakhstan were). Renaming each
//    to its US-recognized country and dissolving merges it into that
//    country's own shape, welding the shared boundary away entirely since
//    Natural Earth's subunits share topology with their parent for exactly
//    this purpose. Cases handled: Crimea → Ukraine, Baikonur (leased to
//    Russia, but Kazakhstan's sovereign territory) → Kazakhstan, Western
//    Sahara → Morocco (the US recognized Moroccan sovereignty in 2020),
//    Somaliland → Somalia, and Northern Cyprus → Cyprus (recognized by no
//    UN member besides Turkey). Kosovo is left alone — the US recognizes
//    its independence, so Natural Earth's own attribution already matches.
//    Taiwan is deliberately left alone too: official US policy is a
//    calculated ambiguity, not a recognition either way, so there's no
//    "US-recognized" answer to move it to.
//
// 2. Merging internal administrative subdivisions into their one sovereign
//    country. This is the bulk of SOVEREIGNTY_OVERRIDES below, and it's a
//    different situation from part 1: nothing here is disputed, Natural
//    Earth just ships each subdivision as its own separate piece — Bosnia
//    and Herzegovina's three constitutional entities, the UK's four home
//    nations, Japan's main islands, and so on all have matching SOVEREIGNT
//    values already, they're simply not merged into one shape by default.
//    Left alone, the country list wouldn't match any normal reference list
//    of the world's countries (there'd be a "Republika Srpska" to select
//    instead of "Bosnia and Herzegovina"), and each piece would carry its
//    own visible border seam. A handful of well-known, populated,
//    non-contiguous territories are deliberately exempted and stay
//    separate — French Guiana, Puerto Rico, Bermuda, and the like — since
//    those genuinely appear as their own entries in every standard list of
//    countries and territories. Gaza and West Bank are merged into a new
//    "Palestine" entry, separate from Israel, matching that same kind of
//    reference list rather than either country's own position.
//
// 3. Coastline simplification. The raw 10m-resolution source has far more
//    points than a rotating globe needs, and feeding all of it to the
//    triangulator taxes the main thread for ~11 seconds on load. Capped at
//    50% specifically because anything more aggressive causes small
//    multi-island territories (Caribbean Netherlands' Bonaire/Sint
//    Eustatius/Saba, in particular) to lose their smaller islands entirely —
//    mapshaper's `keep-shapes` flag only guarantees a *feature* survives
//    simplification, not that every one of its separate islands does.
//    Antarctica gets a second, much more aggressive simplification pass on
//    top of this one (see ANTARCTICA_SIMPLIFY_PERCENT below) — its coastline
//    is far more geometrically complex than anywhere else in the dataset,
//    and ConicPolygonGeometry's triangulation scales roughly quadratically
//    with ring size, so left at this pass's normal 50% its largest ring
//    (~9600 points) alone took over 10 seconds to build a cap mesh for.
//    Since it's never selected or zoomed into, the extra simplification
//    costs nothing visible at the whole-globe scale it's actually seen at.
//    Before that pass runs, its ring also gets stripped of flat-map "closing
//    edge" points (see stripMapEdgePoints below) — otherwise those render as
//    a visible spike from the coast through the pole and back, since points
//    that are only distinct on a rectangular projection collapse to the same
//    physical point on a real sphere.
//
// 4. Dropping insignificant islet rings from many-island countries. Natural
//    Earth's per-country shapes include every tiny skerry as its own
//    separate ring — Canada alone has 400+. The app renders all of a
//    country's rings as one merged mesh, so ring count doesn't cost draw
//    calls, but it does cost triangles: with every island included, the
//    world renders ~800k triangles, enough to make a real difference to
//    frame rate. Since a handful of large landmasses already carry the
//    recognizable shape of these countries, rings under 300km² are dropped
//    — but only for countries with more than 10 rings to begin with, so a
//    small nation that's naturally made of a few islands (Caribbean
//    Netherlands' three, again) never has anything removed regardless of
//    its size.
//
// 5. Reassigning or dropping orphan interior holes. Some real enclaves
//    (Vatican City/San Marino sitting inside Italy, Lesotho inside South
//    Africa) exist in the source as a hole cut into the surrounding
//    country's polygon *and* as their own separately filled shape, so the
//    two sit flush and it reads as one seamless coastline. Others, like
//    Llívia — a Spanish town entirely surrounded by France — exist only as
//    the hole, with no separate filled shape for the enclave itself; left
//    alone that just exposes bare ocean color for no visible reason. Known
//    cases like Llívia are given their real owner as a new disjoint piece of
//    that country's own shape, reusing the hole ring itself (it already
//    traces the enclave's true boundary) rather than dropping it. Any other
//    unrecognized orphan hole — one this script doesn't have a named owner
//    for — is dropped instead, letting the surrounding country's own color
//    fill it in.
//
// 6. Adding Vatican City. Natural Earth's admin-0 map subunits layer (the
//    source this whole script is built on) carries a "Vatican" entry with
//    no geometry at all attached — not a hole in Italy, not a filled shape,
//    nothing. data/sources/vatican-city.geojson is its real ADM0 boundary
//    from geoBoundaries (CC-BY 4.0 — see https://www.geoboundaries.org),
//    added as its own feature the same way the hardcoded placeholder this
//    replaced was. geoBoundaries was evaluated as a full replacement for
//    the whole pipeline, not just this one gap — abandoned: its 229
//    country files each come from a different, independent source (OSM in
//    some cases, satellite land-cover in others, national surveys
//    elsewhere), unlike Natural Earth's one consistent dataset where every
//    country's borders are guaranteed to line up with its neighbors'.
//    Combined and simplified, that produced tens of thousands of
//    unresolved geometry intersections between adjacent countries and
//    outright broke rendering on at least one feature. Vatican has no
//    neighbor going through this pipeline to misalign with (Italy's shape
//    doesn't depend on it), so it's a safe, isolated case to take from the
//    better source anyway.
//
// 7. Splicing in raw, unsimplified geometry for a handful of small nations
//    the main pipeline above treats badly (see RAW_GEOMETRY_NAMES below).
//    Step 3's uniform 50% coastline simplification and step 4's 300km²
//    islet-drop threshold are both tuned for large landmasses, where
//    trimming detail or dropping a stray skerry doesn't change the
//    recognizable shape. Applied to a nation whose defining shape *is* a
//    scatter of small islands (Kiribati's 33 atolls, most under 100km²,
//    collapsed to the single one that happened to clear the 300km²
//    threshold; Tuvalu's 9 atolls, all of them small enough that even the
//    50% simplify pass alone reduced the whole country to one degenerate
//    4-point sliver) or a country the size of a few city blocks (Monaco,
//    Nauru, Singapore), the result is either most of the country's islands
//    disappearing or a coastline crushed down to a handful of almost-random
//    points. These five skip the shared pipeline entirely and use their
//    raw source geometry instead (cleaned, not simplified) — their combined
//    point count is small enough next to landmasses like Canada or Russia
//    that skipping simplification for them costs nothing noticeable.
//    Monaco is the one exception worth calling out: it has a real land
//    border with France, which *does* go through the main pipeline, so
//    their shared boundary is no longer guaranteed to align exactly after
//    this — tested and the gap is sub-kilometer, invisible at the scale
//    this globe is ever actually viewed at, but it's a real trade-off, not
//    a free one. The other four are islands with no shared land border
//    with anything, so there's no such trade-off for them.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { geoArea } from 'd3-geo'
import mapshaper from 'mapshaper'
import { feature } from 'topojson-client'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const sourcePath = `${rootDir}data/sources/country-boundaries-raw.topojson`
const outPath = `${rootDir}public/data/countries.json`

const SOVEREIGNTY_OVERRIDES = {
  Crimea: 'Ukraine',
  Baikonur: 'Kazakhstan',
  'W. Sahara': 'Morocco',
  Somaliland: 'Somalia',
  'N. Cyprus': 'Cyprus',
  // The UN buffer zone dividing Northern Cyprus from the rest of the
  // island — since Northern Cyprus itself is already folded into Cyprus
  // above, leaving this as its own excluded strip just cut a blank line
  // through the middle of the country it now belongs to.
  'Cyprus U.N. Buffer Zone': 'Cyprus',
  // The US takes no recognition position on Kashmir at all (long-standing
  // policy is neutral, deferring to bilateral India-Pakistan resolution),
  // so unlike the cases above there's no "US-recognized" side to move this
  // to. Folded into India anyway, matching the same practical-effect logic
  // as Baikonur: India has had de facto military control since 1984, and
  // leaving it as its own "Kashmir"-attributed sliver only produced a
  // stray triangular border seam at the India/Pakistan/China trijunction.
  'Siachen Glacier': 'India',
  // Unclaimed by both Egypt and Sudan — a quirk of the two countries citing
  // different colonial-era boundary treaties, each of which would give this
  // strip to the *other* country, so both disclaim it instead. There's no
  // "US-recognized" side here either, but leaving it unresolved just shows
  // as a hole in the map between two countries that do exist, so it's
  // folded into Sudan instead.
  'Bir Tawil': 'Sudan',

  // Everything below merges an internal administrative subdivision into its
  // one sovereign country, so the list of selectable countries matches a
  // normal reference list of the world's countries and territories (Bosnia
  // and Herzegovina's three constitutional entities, the UK's four home
  // nations, Japan's main islands, etc. — none of these are "disputes",
  // Natural Earth just ships each subdivision as its own piece). A handful
  // of well-known, populated, non-contiguous territories are deliberately
  // exempted and stay separate — French Guiana, Puerto Rico, Bermuda, and
  // the like — since those genuinely appear as their own entries in every
  // standard list of countries and territories.
  'Isla Sala y Gomez': 'Chile',
  'Easter I.': 'Chile',
  Dhekelia: 'United Kingdom',
  'N. Ireland': 'United Kingdom',
  Akrotiri: 'United Kingdom',
  Wales: 'United Kingdom',
  England: 'United Kingdom',
  Scotland: 'United Kingdom',
  'Diego Garcia NSF': 'United Kingdom',
  'Br. Indian Ocean Ter.': 'United Kingdom',
  'S. Sandwich Is.': 'United Kingdom',
  'S. Georgia': 'United Kingdom',
  Sark: 'United Kingdom',
  Alderney: 'United Kingdom',
  Herm: 'United Kingdom',
  'St. Helena': 'Saint Helena, Ascension and Tristan da Cunha',
  Ascension: 'Saint Helena, Ascension and Tristan da Cunha',
  'Tristan da Cunha': 'Saint Helena, Ascension and Tristan da Cunha',
  Lakshadweep: 'India',
  'Andaman Is.': 'India',
  'Nicobar Is.': 'India',
  Hainan: 'China',
  'Paracel Is.': 'China',
  // See the Israel/Palestine note above the excluded-names list below.
  Gaza: 'Palestine',
  'West Bank': 'Palestine',
  Puntland: 'Somalia',
  Zanzibar: 'Tanzania',
  'UNDOF Zone': 'Syria',
  'Juan De Nova I.': 'France',
  'Fr. S. Antarctic Lands': 'France',
  Corsica: 'France',
  'Europa Island': 'France',
  'Clipperton I.': 'France',
  'Bassas da India': 'France',
  'Tromelin I.': 'France',
  'Glorioso Is.': 'France',
  'Korean DMZ (south)': 'South Korea',
  Jejudo: 'South Korea',
  Ulleungdo: 'South Korea',
  Baengnyeongdo: 'South Korea',
  Dokdo: 'South Korea',
  'Korean DMZ (north)': 'North Korea',
  'Prince Edward Is.': 'South Africa',
  'Jan Mayen I.': 'Svalbard and Jan Mayen',
  'Svalbard Is.': 'Svalbard and Jan Mayen',
  'Bouvet I.': 'Norway',
  Åland: 'Finland',
  Flemish: 'Belgium',
  Walloon: 'Belgium',
  Brussels: 'Belgium',
  Adjara: 'Georgia',
  Ceuta: 'Spain',
  Melilla: 'Spain',
  'Canary Is.': 'Spain',
  'Balearic Is.': 'Spain',
  Bornholm: 'Denmark',
  'Iraqi Kurdistan': 'Iraq',
  Pantelleria: 'Italy',
  Sicily: 'Italy',
  Sardinia: 'Italy',
  'Isole Pelagie': 'Italy',
  Vojvodina: 'Serbia',
  'Pante Makasar': 'East Timor',
  'Timor-Leste': 'East Timor',
  'Fed. of Bos. & Herz.': 'Bosnia and Herzegovina',
  'Rep. Srpska': 'Bosnia and Herzegovina',
  'Brcko District': 'Bosnia and Herzegovina',
  'USNB Guantanamo Bay': 'Cuba',
  'Galápagos Is.': 'Ecuador',
  Madeira: 'Portugal',
  Azores: 'Portugal',
  Alaska: 'United States of America',
  'Johnston Atoll': 'United States of America',
  Hawaii: 'United States of America',
  'Jarvis I.': 'United States of America',
  'Baker I.': 'United States of America',
  'Howland I.': 'United States of America',
  'Wake Atoll': 'United States of America',
  'Midway Is.': 'United States of America',
  'Navassa I.': 'United States of America',
  'Palmyra Atoll': 'United States of America',
  'Kingman Reef': 'United States of America',
  Bougainville: 'Papua New Guinea',
  Socotra: 'Yemen',
  'Río Muni': 'Equatorial Guinea',
  Annobón: 'Equatorial Guinea',
  Bioko: 'Equatorial Guinea',
  'Heard I. and McDonald Is.': 'Australia',
  Tasmania: 'Australia',
  'Macquarie I.': 'Australia',
  'Coral Sea Is.': 'Australia',
  'Ashmore and Cartier Is.': 'Australia',
  'N.Z. SubAntarctic Is.': 'New Zealand',
  'Chatham Is.': 'New Zealand',
  'Kermadec Is.': 'New Zealand',
  'South I.': 'New Zealand',
  'North I.': 'New Zealand',
  Kyushu: 'Japan',
  Shikoku: 'Japan',
  Honshu: 'Japan',
  Hokkaido: 'Japan',
  'Nansei-shoto': 'Japan',
  'Volcano Is.': 'Japan',
  'Bonin Is.': 'Japan',
  'Izu-shoto': 'Japan',
  Trinidad: 'Trinidad and Tobago',
  Tobago: 'Trinidad and Tobago',
  Antigua: 'Antigua and Barbuda',
  Barbuda: 'Antigua and Barbuda',
  'São Tomé': 'São Tomé and Príncipe',
  Principe: 'São Tomé and Príncipe',
  Kaliningrad: 'Russia',

  // Cosmetic-only renames from here down: each of these is already its own
  // single piece, just under Natural Earth's abbreviated form (`Rep.`,
  // `Is.`, `Dem. Rep.`) or an alternate name — renamed to match how the
  // reference list of countries and territories this was checked against
  // spells them, since the dropdown is meant to read naturally.
  'Central African Rep.': 'Central African Republic',
  Congo: 'Republic of the Congo',
  Czechia: 'Czech Republic',
  "Côte d'Ivoire": 'Ivory Coast',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Dominican Rep.': 'Dominican Republic',
  'S. Sudan': 'South Sudan',
  eSwatini: 'Eswatini',
  'Cabo Verde': 'Cape Verde',
  'Faeroe Is.': 'Faroe Islands',
  'Fr. Polynesia': 'French Polynesia',
  'Cayman Is.': 'Cayman Islands',
  'British Virgin Is.': 'British Virgin Islands',
  'U.S. Virgin Is.': 'U.S. Virgin Islands',
  'Turks and Caicos Is.': 'Turks and Caicos Islands',
  'Marshall Is.': 'Marshall Islands',
  'Solomon Is.': 'Solomon Islands',
  'N. Mariana Is.': 'Northern Mariana Islands',
  'Pitcairn Is.': 'Pitcairn Islands',
  'Falkland Is.': 'Falkland Islands',
  'Cook Is.': 'Cook Islands',
  'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'St. Pierre and Miquelon': 'Saint Pierre and Miquelon',
  'St-Martin': 'Saint Martin',
  'St-Barthélemy': 'Saint Barthélemy',
  'St. Vin. and Gren.': 'Saint Vincent and the Grenadines',
  Micronesia: 'Federated States of Micronesia',
  'Wallis and Futuna Is.': 'Wallis and Futuna',
  'Christmas I.': 'Christmas Island',
  'Cocos Is.': 'Cocos (Keeling) Islands',
  Macao: 'Macau',
}

// None of these have any real, recognized owner to merge into (unclaimed,
// actively disputed with no resolution, or a neutral buffer zone) and none
// appear in any standard list of countries and territories.
const UNCLAIMED_OR_DISPUTED_NAMES = [
  'Bajo Nuevo Bank',
  'Brazilian I.',
  'Scarborough Reef',
  'Serranilla Bank',
  'Southern Patagonian Ice Field',
  'Spratly Is.',
]

// Dropped outright, not merged anywhere: a couple of small uninhabited
// Antarctic-claim islands (no country of their own, and no genealogical
// relevance either way — Antarctica's own mainland is kept, see below),
// plus UNCLAIMED_OR_DISPUTED_NAMES above.
const EXCLUDED_NAMES = new Set(['S. Orkney Is.', 'Peter I I.', ...UNCLAIMED_OR_DISPUTED_NAMES])

const SIMPLIFY_PERCENT = '50%'
const RING_COUNT_THRESHOLD = 10
const MIN_RING_AREA_KM2 = 300
const EARTH_RADIUS_KM = 6371
const MIN_RING_AREA_SR = MIN_RING_AREA_KM2 / (EARTH_RADIUS_KM * EARTH_RADIUS_KM)

function dropInsignificantIslets(geoJsonFeature) {
  const { geometry } = geoJsonFeature
  if (geometry.type !== 'MultiPolygon' || geometry.coordinates.length <= RING_COUNT_THRESHOLD) {
    return geoJsonFeature
  }

  const ringsByArea = geometry.coordinates
    .map((ring) => ({ ring, area: geoArea({ type: 'Polygon', coordinates: ring }) }))
    .sort((a, b) => b.area - a.area)
  const keptRings = ringsByArea.filter((x, i) => i === 0 || x.area >= MIN_RING_AREA_SR).map((x) => x.ring)

  return {
    ...geoJsonFeature,
    geometry: keptRings.length === 1 ? { type: 'Polygon', coordinates: keptRings[0] } : { type: 'MultiPolygon', coordinates: keptRings },
  }
}

function simpleBounds(ring) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return [minLng, minLat, maxLng, maxLat]
}

const HOLE_MATCH_TOLERANCE_DEG = 0.01

function boundsClose(a, b) {
  return (
    Math.abs(a[0] - b[0]) < HOLE_MATCH_TOLERANCE_DEG &&
    Math.abs(a[1] - b[1]) < HOLE_MATCH_TOLERANCE_DEG &&
    Math.abs(a[2] - b[2]) < HOLE_MATCH_TOLERANCE_DEG &&
    Math.abs(a[3] - b[3]) < HOLE_MATCH_TOLERANCE_DEG
  )
}

function subPolygonsOf(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

// Reversing point order flips a ring's winding direction — needed to turn a
// hole (wound opposite its parent's exterior ring) into a standalone filled
// exterior ring for its own feature.
function reversedRing(ring) {
  return ring.slice().reverse()
}

// Orphan holes with a real, known owner: the hole traces the enclave's true
// boundary, so instead of being dropped it's added as a new disjoint piece
// of the owner's own shape. `near` is an approximate [lng, lat] used only to
// pick the right hole out of whichever country it's cut into.
const ENCLAVE_HOLE_OWNERS = [{ holeIn: 'France', owner: 'Spain', near: [1.97, 42.46] }]
const ENCLAVE_MATCH_TOLERANCE_DEG = 0.5

// See parts 5 and 6 in the header comment above.
function fixOrphanHoles(features) {
  const exteriorBounds = features.flatMap((f) => subPolygonsOf(f.geometry).map((rings) => simpleBounds(rings[0])))
  const enclavesByOwner = new Map()

  const withHolesFixed = features.map((f) => {
    const subPolygons = subPolygonsOf(f.geometry).map((rings) => {
      if (rings.length === 1) return rings
      const [exterior, ...holes] = rings
      const keptHoles = holes.filter((hole) => {
        const holeBounds = simpleBounds(hole)
        if (exteriorBounds.some((b) => boundsClose(b, holeBounds))) return true

        const [minLng, minLat, maxLng, maxLat] = holeBounds
        const center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
        const enclave = ENCLAVE_HOLE_OWNERS.find(
          (e) =>
            e.holeIn === f.properties.NAME &&
            Math.hypot(e.near[0] - center[0], e.near[1] - center[1]) < ENCLAVE_MATCH_TOLERANCE_DEG,
        )
        if (enclave) {
          const pieces = enclavesByOwner.get(enclave.owner) ?? []
          pieces.push([reversedRing(hole)])
          enclavesByOwner.set(enclave.owner, pieces)
        }
        return false
      })
      return [exterior, ...keptHoles]
    })
    return {
      ...f,
      geometry:
        f.geometry.type === 'Polygon'
          ? { type: 'Polygon', coordinates: subPolygons[0] }
          : { type: 'MultiPolygon', coordinates: subPolygons },
    }
  })

  return withHolesFixed.map((f) => {
    const extraPieces = enclavesByOwner.get(f.properties.NAME)
    if (!extraPieces) return f
    return { ...f, geometry: { type: 'MultiPolygon', coordinates: [...subPolygonsOf(f.geometry), ...extraPieces] } }
  })
}

// See part 6 in the header comment above.
const vaticanSourcePath = `${rootDir}data/sources/vatican-city.geojson`

async function vaticanCityFeature() {
  const cleaned = await simplify(
    { 'in.json': readFileSync(vaticanSourcePath, 'utf8') },
    '-i in.json -clean rewind -each "NAME=shapeName" -filter-fields NAME -o format=geojson out.json',
  )
  return JSON.parse(cleaned['out.json']).features[0]
}

function simplify(inputFiles, command) {
  return new Promise((resolve, reject) => {
    mapshaper.applyCommands(command, inputFiles, (err, output) => (err ? reject(err) : resolve(output)))
  })
}

// See part 7 in the header comment above.
const RAW_GEOMETRY_NAMES = ['Kiribati', 'Tuvalu', 'Nauru', 'Monaco', 'Singapore']

async function rawGeometryFeatures(names) {
  const rawTopology = JSON.parse(readFileSync(sourcePath, 'utf8'))
  const rawFeatures = feature(rawTopology, rawTopology.objects[Object.keys(rawTopology.objects)[0]]).features
  const selected = names.map((name) => rawFeatures.find((f) => f.properties.NAME === name)).filter(Boolean)
  const cleaned = await simplify(
    { 'in.json': JSON.stringify({ type: 'FeatureCollection', features: selected }) },
    // No -simplify here — that's the entire point. Just winding/topology
    // cleanup, same as every other feature gets after its own simplify pass.
    '-i in.json -clean rewind -filter-fields NAME -o format=geojson out.json',
  )
  return JSON.parse(cleaned['out.json']).features
}

// Single-quoted string literals, since the whole expression is itself
// wrapped in double quotes for mapshaper's own command-line tokenizer
// (`-each "..."`) — a name with an apostrophe (Côte d'Ivoire) needs that
// apostrophe escaped or it closes the literal early.
const quote = (value) => `'${value.replace(/'/g, "\\'")}'`
const renameExpr = Object.entries(SOVEREIGNTY_OVERRIDES)
  .map(([from, to]) => `if (NAME==${quote(from)}) NAME=${quote(to)};`)
  .join(' ')
const excludeExpr = [...EXCLUDED_NAMES].map((name) => `NAME != ${quote(name)}`).join(' && ')

const simplifyCommand =
  `-i in.json ` +
  `-each "${renameExpr}" ` +
  `-dissolve NAME copy-fields=NAME ` + // welds each renamed subunit into its target country's shape, since they share topology
  `-simplify ${SIMPLIFY_PERCENT} keep-shapes ` +
  `-clean rewind ` + // simplification can leave a handful of self-intersecting/mis-wound rings, which triangulate with visible gaps
  `-filter "${excludeExpr}" ` + // a few small uninhabited islands/unclaimed areas with no genealogical relevance
  `-filter-fields NAME ` +
  `-o format=topojson quantization=1e5 out.json`

const simplified = await simplify({ 'in.json': readFileSync(sourcePath, 'utf8') }, simplifyCommand)
const simplifiedTopology = JSON.parse(simplified['out.json'])
const simplifiedFeatures = feature(
  simplifiedTopology,
  simplifiedTopology.objects[Object.keys(simplifiedTopology.objects)[0]],
).features

// See part 3 in the header comment above.
const ANTARCTICA_SIMPLIFY_PERCENT = '10%'

// Natural Earth's Antarctica ring closes by tracing along the literal edges
// of a flat rectangular map — a run of points at exactly lat=-90 regardless
// of longitude (the map's bottom edge), and a matching "there and back" run
// along lng=180 then lng=-180 (the map's two side edges, which are the same
// meridian). Both are correct and invisible on a flat projection, but every
// point in a lat=-90 run is the identical physical point on a sphere, and
// lng=180/-180 are the identical meridian — so on the actual 3D globe this
// renders as a visible spike from the coast down through the pole and back,
// not a real coastline feature. Stripping them and reconnecting the real
// coastline points on either side removes the spike with no loss of actual
// coastline detail (these points never described real terrain).
function stripMapEdgePoints(ring) {
  const filtered = ring.filter(([lng, lat]) => lat > -89.99 && Math.abs(lng) < 179.99)
  if (filtered.length < 4) return ring
  const [firstLng, firstLat] = filtered[0]
  const [lastLng, lastLat] = filtered[filtered.length - 1]
  if (firstLng !== lastLng || firstLat !== lastLat) filtered.push(filtered[0])
  return filtered
}

async function simplifyAntarctica(features) {
  const index = features.findIndex((f) => f.properties.NAME === 'Antarctica')
  if (index === -1) return features

  const antarctica = features[index]
  const cleanedSubPolygons = subPolygonsOf(antarctica.geometry).map((rings) => rings.map(stripMapEdgePoints))
  const cleanedAntarctica = {
    ...antarctica,
    geometry:
      antarctica.geometry.type === 'Polygon'
        ? { type: 'Polygon', coordinates: cleanedSubPolygons[0] }
        : { type: 'MultiPolygon', coordinates: cleanedSubPolygons },
  }

  const out = await simplify(
    { 'in.json': JSON.stringify({ type: 'FeatureCollection', features: [cleanedAntarctica] }) },
    `-i in.json -simplify ${ANTARCTICA_SIMPLIFY_PERCENT} keep-shapes -clean rewind -o format=geojson out.json`,
  )
  const [simplifiedAntarctica] = JSON.parse(out['out.json']).features
  return features.map((f, i) => (i === index ? simplifiedAntarctica : f))
}

const dropped = simplifiedFeatures.filter((f) => !f.geometry).map((f) => f.properties.NAME)
const rawGeomByName = new Map(
  (await rawGeometryFeatures(RAW_GEOMETRY_NAMES)).map((f) => [f.properties.NAME, f]),
)
const reduced = await simplifyAntarctica([
  ...fixOrphanHoles(simplifiedFeatures.filter((f) => f.geometry).map(dropInsignificantIslets)).map(
    (f) => rawGeomByName.get(f.properties.NAME) ?? f,
  ),
  await vaticanCityFeature(),
])

const ringsBefore = simplifiedFeatures.reduce(
  (sum, f) => sum + (f.geometry ? (f.geometry.type === 'Polygon' ? 1 : f.geometry.coordinates.length) : 0),
  0,
)
const ringsAfter = reduced.reduce((sum, f) => sum + (f.geometry.type === 'Polygon' ? 1 : f.geometry.coordinates.length), 0)

const final = await simplify(
  { 'reduced.json': JSON.stringify({ type: 'FeatureCollection', features: reduced }) },
  // Higher quantization than the first pass: by now the data's already down
  // to ~1100 rings, so the extra precision costs very little extra file
  // size, but 1e5 (~400m grid cells at the equator) was fine enough to
  // silently collapse Vatican City's ~150m width to a degenerate, geometry-
  // less feature. 1e7 (~4m cells) comfortably resolves it.
  '-i reduced.json -rename-layers countries -o format=topojson quantization=1e7 out.json',
)

writeFileSync(outPath, final['out.json'])

console.log(`Wrote ${reduced.length} countries (${ringsBefore} -> ${ringsAfter} rings) to ${outPath}`)
if (dropped.length > 0) {
  console.log(`Dropped ${dropped.length} with no geometry in the source data: ${dropped.join(', ')}`)
}
