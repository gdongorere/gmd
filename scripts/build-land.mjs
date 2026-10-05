// Bakes Natural Earth 1:110m land polygons (via world-atlas, public domain) into a compact JSON
// of [lon, lat] rings for the canvas globe. Run: node scripts/build-land.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/land-110m.json'), 'utf8'));
const land = feature(topo, topo.objects.land);
const rings = [];
const polys = land.features ? land.features.flatMap((f) => f.geometry) : [land.geometry ?? land];
for (const g of polys) {
	const list = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
	for (const poly of list) for (const ring of poly) rings.push(ring.map(([lo, la]) => [Math.round(lo * 20) / 20, Math.round(la * 20) / 20]));
}
writeFileSync('public/solar/land.json', JSON.stringify(rings));
console.log(`rings: ${rings.length}, points: ${rings.reduce((n, r) => n + r.length, 0)}`);
