// src/lib/fly/earth/loaders.ts
// Browser-side data loaders with the provider fallback chain. Fetch and decode are injectable so the fallback logic is unit-tested without a
// browser; the defaults use the real fetch and createImageBitmap.

import { type TileId } from './geo';
import { type ImageryProvider, ancestorAt } from './imagery';

export interface LoaderIO {
	fetchBlob(url: string, signal: AbortSignal): Promise<Blob>;
	decode(blob: Blob): Promise<ImageBitmap>;
}

export const browserIO: LoaderIO = {
	async fetchBlob(url, signal) {
		const res = await fetch(url, { signal, mode: 'cors', referrerPolicy: 'no-referrer' });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.blob();
	},
	decode: (blob) => createImageBitmap(blob),
};

const DISABLE_AFTER = 3;

/**
 * Tries each provider in order. A provider that fails three times in a row is switched off for the session (no hammering a blocked host);
 * a coarser provider answers with an ancestor tile, and the manager maps the right window of it. Resolves null when nothing worked.
 */
export function makeImageLoader(providers: ImageryProvider[], io: LoaderIO = browserIO) {
	const fails = new Map<string, number>();
	const loader = async (id: TileId, signal: AbortSignal): Promise<{ image: ImageBitmap; tile: TileId } | null> => {
		for (const p of providers) {
			if ((fails.get(p.id) ?? 0) >= DISABLE_AFTER) continue;
			const tile = ancestorAt(id, p.maxZoom);
			try {
				const bmp = await io.decode(await io.fetchBlob(p.url(tile), signal));
				fails.set(p.id, 0);
				return { image: bmp, tile };
			} catch {
				if (signal.aborted) return null;
				fails.set(p.id, (fails.get(p.id) ?? 0) + 1);
			}
		}
		return null;
	};
	loader.failures = (id: string) => fails.get(id) ?? 0;
	return loader;
}
