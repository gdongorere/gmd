import type { Pool, Pressure, QualityTier } from './types';

const MB = 1024 * 1024;

/** Byte budgets per quality tier (docs/fly/12 §8). */
export const TIER_BUDGETS: Record<QualityTier, Record<Pool, number>> = {
	ultra: { gpu: 600 * MB, heap: 400 * MB, tiles: 160 * MB },
	high: { gpu: 400 * MB, heap: 260 * MB, tiles: 96 * MB },
	medium: { gpu: 250 * MB, heap: 180 * MB, tiles: 64 * MB },
	low: { gpu: 120 * MB, heap: 100 * MB, tiles: 32 * MB },
	minimal: { gpu: 64 * MB, heap: 60 * MB, tiles: 16 * MB },
};

export const TIER_ORDER: QualityTier[] = ['ultra', 'high', 'medium', 'low', 'minimal'];

/** `ok` below 70 %, `high` from 70 % to 90 %, `critical` above 90 % of the budget. */
export function pressureOf(used: number, budget: number): Pressure {
	if (budget <= 0) return 'critical';
	const f = used / budget;
	if (f > 0.9) return 'critical';
	if (f >= 0.7) return 'high';
	return 'ok';
}

const RANK: Record<Pressure, number> = { ok: 0, high: 1, critical: 2 };

export function worstPressure(a: Pressure, b: Pressure): Pressure {
	return RANK[a] >= RANK[b] ? a : b;
}

/** One tier lower, or the same at the floor. */
export function downgrade(tier: QualityTier): QualityTier {
	return TIER_ORDER[Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(tier) + 1)];
}

/** Starting tier from what the device admits to (all inputs optional; the byte accounting alone is sufficient). */
export function startingTier(opts: { deviceMemoryGB?: number; coarsePointer?: boolean; cores?: number } = {}): QualityTier {
	const { deviceMemoryGB, coarsePointer, cores } = opts;
	let tier: QualityTier = 'high';
	if (deviceMemoryGB !== undefined) {
		tier = deviceMemoryGB >= 8 ? 'high' : deviceMemoryGB >= 4 ? 'medium' : deviceMemoryGB >= 2 ? 'low' : 'minimal';
	} else if (cores !== undefined && cores <= 2) tier = 'low';
	// Phones are capped at medium (iOS kills tabs that use too much).
	if (coarsePointer && TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf('medium')) tier = 'medium'; // better than medium → cap at medium
	return tier;
}

/** Byte accounting per pool against a tier's budget. */
export class Budget {
	private used: Record<Pool, number> = { gpu: 0, heap: 0, tiles: 0 };
	constructor(public tier: QualityTier = 'high') {}

	limit(pool: Pool): number {
		return TIER_BUDGETS[this.tier][pool];
	}
	bytes(pool: Pool): number {
		return this.used[pool];
	}
	add(pool: Pool, bytes: number): void {
		this.used[pool] += bytes;
	}
	release(pool: Pool, bytes: number): void {
		this.used[pool] = Math.max(0, this.used[pool] - bytes);
	}
	pressure(pool: Pool): Pressure {
		return pressureOf(this.used[pool], this.limit(pool));
	}
	/** Worst pressure across pools. */
	overall(): Pressure {
		return (['gpu', 'heap', 'tiles'] as Pool[]).reduce<Pressure>((p, k) => worstPressure(p, this.pressure(k)), 'ok');
	}
	/** Bytes that must be freed to get back under `fraction` of the budget (default 90 %). */
	excess(pool: Pool, fraction = 0.9): number {
		return Math.max(0, this.used[pool] - this.limit(pool) * fraction);
	}
	/** Drop one quality tier when critical. Returns true if the tier changed. */
	relieve(): boolean {
		if (this.overall() !== 'critical') return false;
		const next = downgrade(this.tier);
		if (next === this.tier) return false;
		this.tier = next;
		return true;
	}
}
