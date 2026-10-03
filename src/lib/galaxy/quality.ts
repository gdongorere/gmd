// src/lib/galaxy/quality.ts
// Device capability detection (runs once, < 50 ms) and the runtime quality governor.

import { RenderMode, Tier, isTier, minTier, stepTier, tierIndex } from './tiers';

export interface DeviceProfile {
	/** Highest tier this device is allowed to run. */
	ceiling: RenderMode;
	webgl2: boolean;
	renderer: string;
	mobile: boolean;
	reducedMotion: boolean;
	saveData: boolean;
	reasons: string[];
}

interface NavigatorExtras {
	deviceMemory?: number;
	connection?: { saveData?: boolean; effectiveType?: string };
}

// GPUs that struggle with large additive point clouds.
const VERY_WEAK_GPU = /(Mali-[234]\d\d|Mali-T[67]\d\d|Adreno \(TM\) [23]\d\d|PowerVR SGX|PowerVR Rogue G6|Intel.*(GMA|HD Graphics [2-4]\d{3}|HD Graphics$)|SwiftShader|llvmpipe|Software)/i;
const WEAK_GPU = /(Mali-G[0-9]{2}\b|Mali-G5[0-9]|Adreno \(TM\) [45]\d\d|Adreno \(TM\) 6[01]\d|PowerVR|Intel.*HD Graphics|Intel.*UHD Graphics 6\d\d)/i;
const STRONG_GPU = /(NVIDIA|GeForce|RTX|Quadro|Radeon (RX|Pro)|Apple M\d|Apple GPU|Adreno \(TM\) [78]\d\d|Mali-G7[1-9]\d|Immortalis|Intel.*(Iris Xe|Arc))/i;

function readRenderer(): { webgl: boolean; webgl2: boolean; renderer: string } {
	try {
		const canvas = document.createElement('canvas');
		const gl2 = canvas.getContext('webgl2');
		const gl = gl2 ?? canvas.getContext('webgl');
		if (!gl) return { webgl: false, webgl2: false, renderer: '' };
		const debug = gl.getExtension('WEBGL_debug_renderer_info');
		const renderer = String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
		gl.getExtension('WEBGL_lose_context')?.loseContext();
		return { webgl: true, webgl2: !!gl2, renderer };
	} catch {
		return { webgl: false, webgl2: false, renderer: '' };
	}
}

export function detectDevice(): DeviceProfile {
	const reasons: string[] = [];
	const nav = navigator as Navigator & NavigatorExtras;
	const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	const reducedData = window.matchMedia?.('(prefers-reduced-data: reduce)').matches ?? false;
	const saveData = !!nav.connection?.saveData || reducedData;
	const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
	const mobile = coarse && Math.min(window.screen.width, window.screen.height) < 900;

	const { webgl, webgl2, renderer } = readRenderer();
	if (!webgl) {
		return { ceiling: 'static', webgl2: false, renderer: '', mobile, reducedMotion, saveData, reasons: ['WebGL unavailable'] };
	}

	let ceiling: Tier = 'ultra';
	const cap = (tier: Tier, reason: string) => {
		if (tierIndex(tier) < tierIndex(ceiling)) {
			ceiling = tier;
			reasons.push(reason);
		}
	};

	if (VERY_WEAK_GPU.test(renderer)) cap('minimal', `very weak GPU (${renderer})`);
	else if (WEAK_GPU.test(renderer)) cap(mobile ? 'low' : 'medium', `modest GPU (${renderer})`);
	else if (!STRONG_GPU.test(renderer)) cap(mobile ? 'medium' : 'high', 'unrecognised GPU');

	if (!webgl2) cap('medium', 'WebGL1 only');
	if (mobile) cap('high', 'mobile device');

	const memory = nav.deviceMemory;
	if (memory !== undefined) {
		if (memory <= 2) cap('low', `${memory} GB RAM`);
		else if (memory <= 4) cap('medium', `${memory} GB RAM`);
	}

	const cores = nav.hardwareConcurrency;
	if (cores !== undefined) {
		if (cores <= 2) cap('minimal', `${cores} CPU cores`);
		else if (cores <= 4) cap('low', `${cores} CPU cores`);
	}

	if (saveData) cap('low', 'data saver');

	return { ceiling, webgl2, renderer, mobile, reducedMotion, saveData, reasons };
}

/** `?quality=low` (or static) forces a tier — handy for testing weak devices on a fast one. */
export function qualityOverrideFromUrl(): RenderMode | null {
	try {
		const value = new URLSearchParams(window.location.search).get('quality');
		if (value === 'static' || isTier(value)) return value;
	} catch {
		/* ignore */
	}
	return null;
}

// ---------------------------------------------------------------------------
// Remembered tier: the next visit starts where the governor settled.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'gmd.galaxy.tier.v1';

export function loadSettledTier(renderer: string): Tier | null {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { renderer?: string; tier?: unknown };
		return parsed.renderer === renderer && isTier(parsed.tier) ? parsed.tier : null;
	} catch {
		return null;
	}
}

export function saveSettledTier(renderer: string, tier: Tier) {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ renderer, tier }));
	} catch {
		/* storage unavailable — fine */
	}
}

// ---------------------------------------------------------------------------
// Governor: watches frame times and trades resolution, then star count, for smoothness.
// ---------------------------------------------------------------------------

export const RESOLUTION_STEPS = [1, 0.85, 0.7, 0.6];

export interface GovernorState {
	tier: Tier;
	resolutionStep: number;
}

export type GovernorDecision = 'none' | 'changed';

export class QualityGovernor {
	state: GovernorState;
	private readonly samples = new Float32Array(90);
	private sampleCount = 0;
	private cursor = 0;
	private slowFor = 0;
	private fastFor = 0;
	private upgradeFailed = false;
	private lastChangeAt = 0;
	private lastUpgradeAt = -Infinity;
	private lastP90 = 0;
	private settledSaved = false;

	constructor(
		start: Tier,
		private ceiling: Tier,
		private readonly renderer: string,
		private enabled: boolean,
	) {
		this.state = { tier: minTier(start, ceiling), resolutionStep: 0 };
	}

	setEnabled(enabled: boolean) {
		this.enabled = enabled;
		this.reset();
	}

	setCeiling(ceiling: Tier) {
		this.ceiling = ceiling;
		this.state.tier = minTier(this.state.tier, ceiling);
	}

	reset() {
		this.lastP90 = 0;
		this.sampleCount = 0;
		this.cursor = 0;
		this.slowFor = 0;
		this.fastFor = 0;
	}

	private p90(): number {
		const n = Math.min(this.sampleCount, this.samples.length);
		const sorted = Array.from(this.samples.subarray(0, n)).sort((a, b) => a - b);
		return sorted[Math.floor(n * 0.9)] ?? 0;
	}

	/**
	 * Feed one rendered frame. `frameMs` is the time since the previous rendered
	 * frame, `budgetMs` the target interval. Returns 'changed' when the tier or
	 * resolution should be re-applied.
	 */
	sample(frameMs: number, budgetMs: number, nowMs: number): GovernorDecision {
		if (!this.enabled || frameMs > 250) return 'none'; // ignore stalls (tab switches, GC)
		this.samples[this.cursor] = frameMs;
		this.cursor = (this.cursor + 1) % this.samples.length;
		this.sampleCount++;
		if (this.sampleCount < 30 || nowMs - this.lastChangeAt < 1500) return 'none';

		// Re-rank every 15 frames rather than every frame.
		if (this.sampleCount % 15 === 0) this.lastP90 = this.p90();
		const p90 = this.lastP90;
		if (p90 > budgetMs * 1.4) {
			this.slowFor += frameMs;
			this.fastFor = 0;
		} else if (p90 < budgetMs * 1.1) {
			this.fastFor += frameMs;
			this.slowFor = 0;
		} else {
			this.slowFor = 0;
			this.fastFor = 0;
		}

		if (this.slowFor > 2000) return this.downgrade(nowMs);
		if (this.fastFor > 10_000) return this.upgrade(nowMs);
		if (this.fastFor > 6000 && !this.settledSaved) {
			this.settledSaved = true;
			saveSettledTier(this.renderer, this.state.tier);
		}
		return 'none';
	}

	private downgrade(nowMs: number): GovernorDecision {
		const { tier, resolutionStep } = this.state;
		if (resolutionStep < RESOLUTION_STEPS.length - 1) {
			this.state = { tier, resolutionStep: resolutionStep + 1 };
		} else if (tier !== 'minimal') {
			// Fewer stars at full resolution looks better than many stars at low resolution.
			this.state = { tier: stepTier(tier, -1), resolutionStep: 1 };
		} else {
			return 'none';
		}
		if (nowMs - this.lastUpgradeAt < 20_000) this.upgradeFailed = true;
		return this.commit(nowMs);
	}

	private upgrade(nowMs: number): GovernorDecision {
		// Hysteresis: after an upgrade had to be undone, stay put for the session.
		if (this.upgradeFailed) return 'none';
		const { tier, resolutionStep } = this.state;
		if (resolutionStep > 0) {
			this.state = { tier, resolutionStep: resolutionStep - 1 };
		} else if (tierIndex(tier) < tierIndex(this.ceiling)) {
			this.state = { tier: stepTier(tier, 1), resolutionStep: 1 };
		} else {
			this.fastFor = 0;
			return 'none';
		}
		this.lastUpgradeAt = nowMs;
		return this.commit(nowMs);
	}

	private commit(nowMs: number): GovernorDecision {
		this.lastChangeAt = nowMs;
		this.settledSaved = false;
		this.reset();
		saveSettledTier(this.renderer, this.state.tier);
		return 'changed';
	}
}
