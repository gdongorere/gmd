import { describe, expect, it, vi } from 'vitest';
import { Budget, TIER_BUDGETS, downgrade, pressureOf, startingTier } from './budget';
import { ResourceTracker, geometryBytes, textureBytes } from './resource';

const MB = 1024 * 1024;

describe('pressure levels (docs/fly/12 §8)', () => {
	it('ok < 70 %, high 70–90 %, critical > 90 %', () => {
		expect(pressureOf(69, 100)).toBe('ok');
		expect(pressureOf(70, 100)).toBe('high');
		expect(pressureOf(90, 100)).toBe('high');
		expect(pressureOf(91, 100)).toBe('critical');
		expect(pressureOf(1, 0)).toBe('critical');
	});
});

describe('tier table', () => {
	it('GPU budgets shrink strictly with tier and match the doc', () => {
		expect(TIER_BUDGETS.ultra.gpu).toBe(600 * MB);
		expect(TIER_BUDGETS.minimal.gpu).toBe(64 * MB);
		const g = Object.values(TIER_BUDGETS).map((b) => b.gpu);
		expect([...g].sort((a, b) => b - a)).toEqual(g);
	});
	it('downgrade steps down and stops at the floor', () => {
		expect(downgrade('ultra')).toBe('high');
		expect(downgrade('minimal')).toBe('minimal');
	});
	it('starting tier follows device memory, phones capped at medium, nothing required', () => {
		expect(startingTier()).toBe('high');
		expect(startingTier({ deviceMemoryGB: 8 })).toBe('high');
		expect(startingTier({ deviceMemoryGB: 4 })).toBe('medium');
		expect(startingTier({ deviceMemoryGB: 1 })).toBe('minimal');
		expect(startingTier({ deviceMemoryGB: 8, coarsePointer: true })).toBe('medium');
		expect(startingTier({ deviceMemoryGB: 1, coarsePointer: true })).toBe('minimal'); // a weak phone is never raised
	});
});

describe('Budget', () => {
	it('accounts, reports pressure, never goes negative, and relieves by dropping a tier', () => {
		const b = new Budget('low');
		b.add('gpu', 115 * MB);
		expect(b.pressure('gpu')).toBe('critical');
		expect(b.excess('gpu')).toBeCloseTo(115 * MB - 0.9 * 120 * MB);
		expect(b.relieve()).toBe(true);
		expect(b.tier).toBe('minimal');
		b.release('gpu', 999 * MB);
		expect(b.bytes('gpu')).toBe(0);
		expect(b.relieve()).toBe(false);
	});
});

describe('ResourceTracker (no leaks)', () => {
	const obj = () => ({ dispose: vi.fn() });

	it('disposes each owner’s objects and returns counts to baseline', () => {
		const t = new ResourceTracker();
		const base = t.counts();
		const a = [obj(), obj(), obj()];
		t.track(a[0], 'moon', 'geometry');
		t.track(a[1], 'moon', 'texture');
		t.track(a[2], 'hangar', 'material');
		expect(t.counts('moon')).toMatchObject({ geometry: 1, texture: 1 });
		expect(t.unloadOwner('moon')).toBe(2);
		expect(a[0].dispose).toHaveBeenCalledOnce();
		expect(a[2].dispose).not.toHaveBeenCalled();
		t.unloadOwner('hangar');
		expect(t.counts()).toEqual(base);
		expect(t.total()).toBe(0);
	});

	it('is idempotent: double track and double release dispose once', () => {
		const t = new ResourceTracker();
		const o = obj();
		t.track(o, 'x', 'geometry');
		t.track(o, 'x', 'geometry');
		expect(t.total()).toBe(1);
		expect(t.release(o)).toBe(true);
		expect(t.release(o)).toBe(false);
		expect(o.dispose).toHaveBeenCalledOnce();
	});

	it('closes bitmaps, terminates workers, and survives a throwing dispose', () => {
		const t = new ResourceTracker();
		const bad = { dispose: vi.fn(() => { throw new Error('boom'); }) };
		const bmp = { close: vi.fn() };
		const w = { terminate: vi.fn() };
		t.track(bad, 'o', 'geometry');
		t.track(bmp, 'o', 'bitmap');
		t.track(w, 'o', 'worker');
		expect(t.disposeAll()).toBe(3);
		expect(bmp.close).toHaveBeenCalled();
		expect(w.terminate).toHaveBeenCalled();
	});

	it('keeps the budget in step with live bytes', () => {
		const b = new Budget('high');
		const t = new ResourceTracker(b);
		const tex = t.track(obj(), 'mars', 'texture', textureBytes(1024, 1024));
		t.track(obj(), 'mars', 'geometry', geometryBytes(1000, 3000));
		expect(b.bytes('gpu')).toBe(textureBytes(1024, 1024) + geometryBytes(1000, 3000));
		t.release(tex);
		expect(b.bytes('gpu')).toBe(geometryBytes(1000, 3000));
		t.unloadOwner('mars');
		expect(b.bytes('gpu')).toBe(0);
	});

	it('lists owners', () => {
		const t = new ResourceTracker();
		t.track(obj(), 'a');
		t.track(obj(), 'b');
		expect(t.owners().sort()).toEqual(['a', 'b']);
	});
});
