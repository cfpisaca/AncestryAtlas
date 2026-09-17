# Ancestral Atlas

A 3D interactive globe that plots family births, deaths, marriages, and migrations across a real map, with a timeline scrubber to play back generations of movement.

## Stack

- [Vite](https://vite.dev/) + React + TypeScript
- [globe.gl](https://github.com/vasturiano/globe.gl) (three.js) for the 3D globe, with real vector country borders rendered directly from GeoJSON — not a texture or a hex approximation
- [d3](https://d3js.org/) for geographic math and (later) timeline scaling

## Development

```bash
npm install
npm run dev
```

## Country border data

`public/data/countries.json` is generated from Natural Earth's 1:10m admin-0 map subunits (`data/sources/`). It's committed, so a normal clone doesn't need to regenerate it — only re-run this after editing `scripts/build-countries-data.mjs` or refreshing the source data:

```bash
npm run data:countries
```

See the comment at the top of `scripts/build-countries-data.mjs` for what the script does (coastline simplification, dropping insignificant islets for performance, and resolving a handful of disputed territories to their US-recognized country) and how to pull a fresh copy of the Natural Earth source.
