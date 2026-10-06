import { describe, expect, it } from 'vitest';
import { makeImageLoader, type LoaderIO } from './loaders';
import { EOX_S2, GIBS_BLUE_MARBLE } from './imagery';

const bmp = { width: 1, height: 1, close() {} } as unknown as ImageBitmap;
const sig = () => new AbortController().signal;

describe('imagery loader fallback chain', () => {
	it('uses the first provider when it works, at the requested tile (clamped to its max zoom)', async () => {
		const urls: string[] = [];
		const io: LoaderIO = { fetchBlob: async (u) => { urls.push(u); return new Blob(); }, decode: async () => bmp };
		const r = await makeImageLoader([EOX_S2, GIBS_BLUE_MARBLE], io)({ z: 13, x: 4, y: 5 }, sig());
		expect(r?.tile).toEqual({ z: 13, x: 4, y: 5 }); expect(urls).toHaveLength(1); expect(urls[0]).toContain('eox');
	});
	it('falls back to the coarser provider and reports the ancestor tile it covered', async () => {
		const io: LoaderIO = { fetchBlob: async (u) => { if (u.includes('eox')) throw new Error('blocked'); return new Blob(); }, decode: async () => bmp };
		const r = await makeImageLoader([EOX_S2, GIBS_BLUE_MARBLE], io)({ z: 12, x: 2200, y: 1400 }, sig());
		expect(r?.tile).toEqual({ z: 8, x: 2200 >> 4, y: 1400 >> 4 });
	});
	it('switches a failing provider off after three failures and stops asking it', async () => {
		let eoxCalls = 0;
		const io: LoaderIO = { fetchBlob: async (u) => { if (u.includes('eox')) { eoxCalls++; throw new Error('blocked'); } return new Blob(); }, decode: async () => bmp };
		const load = makeImageLoader([EOX_S2, GIBS_BLUE_MARBLE], io);
		for (let i = 0; i < 6; i++) await load({ z: 10, x: i, y: 0 }, sig());
		expect(eoxCalls).toBe(3); expect(load.failures(EOX_S2.id)).toBe(3);
	});
	it('resolves null when every provider fails, and does not count an abort as a failure', async () => {
		const bad: LoaderIO = { fetchBlob: async () => { throw new Error('x'); }, decode: async () => bmp };
		expect(await makeImageLoader([EOX_S2, GIBS_BLUE_MARBLE], bad)({ z: 5, x: 1, y: 1 }, sig())).toBeNull();
		const ac = new AbortController(); ac.abort();
		const load = makeImageLoader([EOX_S2], bad);
		expect(await load({ z: 5, x: 1, y: 1 }, ac.signal)).toBeNull(); expect(load.failures(EOX_S2.id)).toBe(0);
	});
});
