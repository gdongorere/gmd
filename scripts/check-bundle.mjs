// Enforces docs/fly/12 §9: the /fly first load stays within budget. Run after `next build`.
// Sums the gzip size of every JS chunk the route's page needs on first load, from Next's build manifests.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dist = '.next';
const BUDGETS = { '/fly': 350 * 1024 };

function chunksFor(route) {
	const files = new Set();
	const build = JSON.parse(readFileSync(join(dist, 'build-manifest.json'), 'utf8'));
	for (const f of [...(build.rootMainFiles ?? []), ...(build.polyfillFiles ?? [])]) files.add(f);
	const pageKey = `app${route}/page`;
	const m = JSON.parse(readFileSync(join(dist, 'app-build-manifest.json'), 'utf8')).pages?.[pageKey] ?? [];
	for (const f of m) files.add(f);
	return { files: [...files].filter((f) => f.endsWith('.js')) };
}

let failed = false;
for (const [route, budget] of Object.entries(BUDGETS)) {
	if (!existsSync(join(dist, 'app-build-manifest.json'))) {
		console.error('No build found: run `npm run build` first.');
		process.exit(2);
	}
	const { files } = chunksFor(route);
	const bytes = files.reduce((n, f) => n + gzipSync(readFileSync(join(dist, f))).length, 0);
	const ok = bytes <= budget;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${route}: ${(bytes / 1024).toFixed(1)} KB gzip first-load JS (budget ${(budget / 1024).toFixed(0)} KB, ${files.length} chunks)`);
	if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);
