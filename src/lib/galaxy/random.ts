// src/lib/galaxy/random.ts
// Seeded PRNG so the galaxy is identical on every load and every device.

export interface Rng {
	/** Uniform in [0, 1). */
	next(): number;
	/** Standard normal (Box–Muller). */
	gaussian(): number;
	/** Laplace (double-exponential) with the given scale — a cheap stand-in for sech² disk profiles. */
	laplace(scale: number): number;
	range(min: number, max: number): number;
}

export function createRng(seed: number): Rng {
	let state = seed >>> 0;
	let spare: number | null = null;

	// mulberry32
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	const gaussian = () => {
		if (spare !== null) {
			const value = spare;
			spare = null;
			return value;
		}
		let u = 0;
		while (u === 0) u = next();
		const v = next();
		const mag = Math.sqrt(-2 * Math.log(u));
		spare = mag * Math.sin(2 * Math.PI * v);
		return mag * Math.cos(2 * Math.PI * v);
	};

	const laplace = (scale: number) => {
		let u = 0;
		while (u === 0) u = next();
		return (next() < 0.5 ? -1 : 1) * -scale * Math.log(u);
	};

	return {
		next,
		gaussian,
		laplace,
		range: (min, max) => min + (max - min) * next(),
	};
}
