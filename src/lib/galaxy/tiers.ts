// src/lib/galaxy/tiers.ts
// Quality tiers. Every lower tier draws a prefix of the same buffers, so it shows
// a random subset of the *same* galaxy and switching tiers never reallocates.

export type Tier = 'ultra' | 'high' | 'medium' | 'low' | 'minimal';
export type RenderMode = Tier | 'static';

export const TIER_ORDER: Tier[] = ['minimal', 'low', 'medium', 'high', 'ultra'];

export interface LayerCounts {
	/** Bulge, bar, thin & thick disk. */
	old: number;
	/** Spiral-arm young stars + Orion Spur. */
	young: number;
	/** Halo field stars, globular clusters, Magellanic Clouds. */
	halo: number;
	/** Unresolved-starlight glow sprites. */
	glow: number;
	/** Dust-lane absorbers. */
	dust: number;
	/** HII regions / reflection nebulae. */
	hii: number;
}

export interface TierSpec {
	counts: LayerCounts;
	/** Device-pixel-ratio ceiling. */
	dprCap: number;
	/** Largest point sprite in device px — protects fill rate on weak GPUs. */
	maxPointSize: number;
	/** Largest nebula/dust sprite in device px. */
	maxGlowSize: number;
	targetFps: number;
	twinkle: boolean;
	/** Approximate GPU vertex memory for this tier (bytes). */
	approxBytes: number;
}

const BYTES_PER_POINT = 27; // 12 (cyl) + 3 (rgb u8) + 12 (meta)
const spec = (counts: LayerCounts, rest: Omit<TierSpec, 'counts' | 'approxBytes'>): TierSpec => ({
	counts,
	approxBytes: Object.values(counts).reduce((sum, n) => sum + n, 0) * BYTES_PER_POINT,
	...rest,
});

export const TIERS: Record<Tier, TierSpec> = {
	ultra: spec(
		{ old: 170_000, young: 70_000, halo: 14_000, glow: 5_000, dust: 9_000, hii: 1_600 },
		{ dprCap: 2, maxPointSize: 48, maxGlowSize: 160, targetFps: 60, twinkle: true },
	),
	high: spec(
		{ old: 100_000, young: 42_000, halo: 9_000, glow: 3_600, dust: 6_500, hii: 1_100 },
		{ dprCap: 1.75, maxPointSize: 40, maxGlowSize: 128, targetFps: 60, twinkle: true },
	),
	medium: spec(
		{ old: 55_000, young: 24_000, halo: 5_000, glow: 2_400, dust: 4_000, hii: 650 },
		{ dprCap: 1.5, maxPointSize: 32, maxGlowSize: 96, targetFps: 60, twinkle: true },
	),
	low: spec(
		{ old: 24_000, young: 11_000, halo: 2_400, glow: 1_200, dust: 2_000, hii: 300 },
		{ dprCap: 1.25, maxPointSize: 24, maxGlowSize: 64, targetFps: 30, twinkle: false },
	),
	minimal: spec(
		{ old: 8_500, young: 4_000, halo: 900, glow: 600, dust: 0, hii: 120 },
		{ dprCap: 1, maxPointSize: 16, maxGlowSize: 40, targetFps: 30, twinkle: false },
	),
};

export const tierIndex = (tier: Tier) => TIER_ORDER.indexOf(tier);
export const minTier = (a: Tier, b: Tier): Tier => (tierIndex(a) <= tierIndex(b) ? a : b);
export const stepTier = (tier: Tier, delta: number): Tier =>
	TIER_ORDER[Math.max(0, Math.min(TIER_ORDER.length - 1, tierIndex(tier) + delta))];

export const isTier = (value: unknown): value is Tier =>
	typeof value === 'string' && (TIER_ORDER as string[]).includes(value);
